require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const bodyParser = require('body-parser');
const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');
const mongoose = require('mongoose');
const cors = require('cors');
const Item = require('./models/Item');
const Person = require('./models/Person');

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || 'http://localhost:3000' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Azure Form Recognizer setup using environment variables
const client = new DocumentAnalysisClient(
    process.env.AZURE_ENDPOINT,
    new AzureKeyCredential(process.env.AZURE_API_KEY)
);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('Error connecting to MongoDB Atlas:', err));

// Helper function to process receipt items including tax and discounts
function processReceiptItems(receiptItems, taxAmount, discountAmount) {
    let items = receiptItems.map((item, index) => {
        let quantity = item.properties.Quantity ? item.properties.Quantity.value : 1;
        let price = item.properties.Price ? item.properties.Price.value : 0;
        let totalPrice = item.properties.TotalPrice ? item.properties.TotalPrice.value : 0;
        let description = item.properties.Description ? item.properties.Description.value.trim() : '';

        if (!description) {
            description = `Item ${index + 1}${totalPrice ? ` ($${totalPrice.toFixed(2)})` : ''}`;
        }

        const weightMatch = description.match(/(\d+(?:\.\d+)?)\s*(lb|oz|g)/i);
        let isWeighted = !!weightMatch;
        if (isWeighted) {
            quantity = parseFloat(weightMatch[1]);
            if (price === 0 && totalPrice !== 0) {
                price = totalPrice / quantity;
            }
        }

        const perUnitMatch = description.match(/(\d+(?:\.\d+)?)\s*@\s*(\d+(?:\.\d+)?)/);
        if (perUnitMatch) {
            quantity = parseFloat(perUnitMatch[1]);
            price = parseFloat(perUnitMatch[2]);
        }

        if (description.toUpperCase() === 'TAX') {
            quantity = 1;
            price = totalPrice = taxAmount;
        }
        if (description.toUpperCase() === 'DISCOUNT') {
            quantity = 1;
            totalPrice = -Math.abs(discountAmount);
        }

        if (totalPrice !== 0 && (quantity === 0 || price === 0)) {
            if (quantity === 0 && price !== 0) {
                quantity = totalPrice / price;
            } else if (price === 0 && quantity !== 0) {
                price = totalPrice / quantity;
            } else {
                quantity = 1;
                price = totalPrice;
            }
        }

        if (Math.abs(totalPrice - (quantity * price)) > 0.01) {
            totalPrice = quantity * price;
        }

        quantity = Math.round(quantity * 100) / 100;
        price = Math.round(price * 100) / 100;
        totalPrice = Math.round(totalPrice * 100) / 100;

        return {
            description,
            quantity,
            price,
            totalPrice,
            isWeighted
        };
    });

    return items.filter(item => item.totalPrice !== 0 || item.description.toUpperCase() === 'TAX');
}


// Updated route for receipt processing
app.post('/process-receipt', async (req, res) => {
    console.log('Received request to process receipt');

    if (!req.body.image) {
        return res.status(400).send({ error: 'No image data received' });
    }

    const base64Image = req.body.image;
    const buffer = Buffer.from(base64Image, 'base64');

    const timeout = 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const poller = await client.beginAnalyzeDocument("prebuilt-receipt", buffer, { abortSignal: controller.signal });
        const { documents: [receipt] } = await poller.pollUntilDone();

        if (!receipt) {
            throw new Error('No receipt data found.');
        }

        const merchantName = receipt.fields.MerchantName ? receipt.fields.MerchantName.value : 'Unknown Merchant';
        const transactionDate = receipt.fields.TransactionDate ? receipt.fields.TransactionDate.value : new Date();
        let total = receipt.fields.Total ? receipt.fields.Total.value : 0;
        let taxAmount = receipt.fields.Tax ? receipt.fields.Tax.value : 0;
        let discountAmount = receipt.fields.Discount ? receipt.fields.Discount.value : 0;

        let items = processReceiptItems(receipt.fields.Items ? receipt.fields.Items.values : [], taxAmount, discountAmount);

        const hasTaxItem = items.some(i => i.description.toUpperCase() === 'TAX');
        const hasDiscountItem = items.some(i => i.description.toUpperCase() === 'DISCOUNT');
        const calculatedTotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
            + (hasTaxItem ? 0 : taxAmount)
            - (hasDiscountItem ? 0 : Math.abs(discountAmount));
        total = Math.round(calculatedTotal * 100) / 100;

        const newItem = new Item({
            type: 'receipt',
            name: merchantName,
            date: transactionDate,
            total: total,
            items: items,
            tax: taxAmount,
            discount: discountAmount
        });

        await newItem.save();

        res.status(200).send(newItem);
    } catch (error) {
        console.error('Error processing receipt:', error);
        if (error.name === 'AbortError') {
            res.status(500).send({ error: 'Receipt processing timed out. Please try again.' });
        } else {
            res.status(500).send({ error: `Failed to process the receipt: ${error.message}` });
        }
    } finally {
        clearTimeout(timeoutId);
    }
});

// Route to fetch receipts
app.get('/receipts', async (req, res) => {
    try {
        const receipts = await Item.find().sort({ date: -1 }).limit(20);
        res.status(200).send(receipts);
    } catch (error) {
        console.error('Error fetching receipts:', error);
        res.status(500).send({ error: 'Failed to fetch receipts' });
    }
});

// Route to delete a receipt
app.delete('/receipts/:id', async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);
        res.status(200).send({ message: 'Receipt deleted successfully' });
    } catch (error) {
        console.error('Error deleting receipt:', error);
        res.status(500).send({ error: 'Failed to delete receipt' });
    }
});

// PUT route to update a receipt
app.put('/receipts/:id', async (req, res) => {
    try {
        const updatedReceipt = await Item.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    items: req.body.items,
                    total: req.body.total,
                    tax: req.body.tax,
                    discount: req.body.discount,
                }
            },
            { new: true }
        );

        if (!updatedReceipt) {
            return res.status(404).send({ error: 'Receipt not found' });
        }

        res.status(200).send(updatedReceipt);
    } catch (error) {
        console.error('Error updating receipt:', error);
        res.status(500).send({ error: 'Failed to update receipt' });
    }
});

// Route to save splits for a receipt
app.put('/receipts/:id/splits', async (req, res) => {
    try {
        const splits = Object.entries(req.body.totals || {}).map(([personName, amount]) => ({
            personName,
            amount: Math.round(amount * 100) / 100
        }));
        const updated = await Item.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    splits,
                    splitAssignments: req.body.assignments || [],
                    splitIncludeTax: req.body.includeTax || false
                }
            },
            { new: true }
        );
        if (!updated) return res.status(404).send({ error: 'Receipt not found' });
        res.status(200).send(updated);
    } catch (error) {
        console.error('Error saving splits:', error);
        res.status(500).send({ error: 'Failed to save splits' });
    }
});

// ── People / Contacts Routes ────────────────────────────

app.get('/people', async (req, res) => {
    try {
        const people = await Person.find().sort({ name: 1 });
        res.status(200).send(people);
    } catch (error) {
        res.status(500).send({ error: 'Failed to fetch people' });
    }
});

app.post('/people', async (req, res) => {
    try {
        const { name, color } = req.body;
        const person = new Person({ name, color });
        const saved = await person.save();
        res.status(201).send(saved);
    } catch (error) {
        res.status(500).send({ error: 'Failed to create person' });
    }
});

app.put('/people/:id', async (req, res) => {
    try {
        const { name, color } = req.body;
        const updated = await Person.findByIdAndUpdate(
            req.params.id,
            { name, color },
            { new: true }
        );
        if (!updated) return res.status(404).send({ error: 'Person not found' });
        res.status(200).send(updated);
    } catch (error) {
        res.status(500).send({ error: 'Failed to update person' });
    }
});

app.delete('/people/:id', async (req, res) => {
    try {
        await Person.findByIdAndDelete(req.params.id);
        res.status(200).send({ message: 'Person deleted' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to delete person' });
    }
});

// Serve React build in production
const path = require('path');
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../build')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../build', 'index.html'));
    });
}

// Start server
if (require.main === module) {
    app.listen(port, () => console.log(`Server running on port ${port}`));
}
module.exports = app;
