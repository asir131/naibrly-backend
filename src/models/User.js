// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');

// const userSchema = new mongoose.Schema({
//     // Common fields for both roles
//     firstName: {
//         type: String,
//         required: [true, 'First name is required'],
//         trim: true
//     },
//     lastName: {
//         type: String,
//         required: [true, 'Last name is required'],
//         trim: true
//     },
//     email: {
//         type: String,
//         required: [true, 'Email is required'],
//         unique: true,
//         lowercase: true,
//         trim: true
//     },
//     password: {
//         type: String,
//         required: [true, 'Password is required'],
//         minlength: 6
//     },
//     phone: {
//         type: String,
//         required: [true, 'Phone number is required']
//     },
//     role: {
//         type: String,
//         enum: ['customer', 'provider', 'admin'],
//         default: 'customer'
//     },
//     profileImage: {
//         type: String, // URL to uploaded image
//         default: ''
//     },
//     address: {
//         street: String,
//         city: String,
//         state: String,
//         zipCode: String,
//         aptSuite: String
//     },
//     isVerified: {
//         type: Boolean,
//         default: false
//     },
//     profileCompleted: {
//         type: Boolean,
//         default: false
//     }
// }, {
//     timestamps: true
// });

// // Hash password before saving
// userSchema.pre('save', async function(next) {
//     if (!this.isModified('password')) return next();
    
//     try {
//         const salt = await bcrypt.genSalt(10);
//         this.password = await bcrypt.hash(this.password, salt);
//         next();
//     } catch (error) {
//         next(error);
//     }
// });

// // Compare password method
// userSchema.methods.comparePassword = async function(candidatePassword) {
//     return await bcrypt.compare(candidatePassword, this.password);
// };

// module.exports = mongoose.model('User', userSchema);