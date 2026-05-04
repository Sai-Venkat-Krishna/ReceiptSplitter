const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    type: String,
    name: String,
    date: Date,
    total: Number,
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    items: [
        {
            description: String,
            quantity: Number,
            price: Number,
            totalPrice: Number,
            isWeighted: Boolean
        }
    ],
    splits: [
        {
            personName: String,
            amount: Number
        }
    ],
    splitAssignments: [
        {
            itemIndex: Number,
            friendIndices: [Number]
        }
    ],
    splitIncludeTax: { type: Boolean, default: false }
});

module.exports = mongoose.model('Item', itemSchema);
