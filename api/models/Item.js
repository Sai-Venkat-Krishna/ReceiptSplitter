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
    // Friend names in column order — friendIndices in splitAssignments
    // point into this array
    splitFriends: [String],
    splitAssignments: [
        {
            itemIndex: Number,
            friendIndices: [Number]
        }
    ],
    splitIncludeTax: { type: Boolean, default: false },
    splitIncludeDiscount: { type: Boolean, default: false },
    // Name of the friend who paid the bill — drives "who owes whom"
    splitPaidBy: { type: String, default: '' }
});

module.exports = mongoose.model('Item', itemSchema);
