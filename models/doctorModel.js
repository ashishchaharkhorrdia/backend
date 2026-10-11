import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    image: { type: String, required: true },
    speciality: { type: String, required: true },
    degree: { type: String, required: true },
    experience: { type: String, required: true },
    about: { type: String, required: true },
    type: { type: String, enum: ['doctor', 'lab'], default: 'doctor' },
    available: { type: Boolean, default: true },
    fees: { type: Number, required: true },
    availableFrom: { type: String, default: '10:00' },
    availableTo: { type: String, default: '21:00' },
    slotDuration: { type: Number, default: 60 },
    tests: { type: [{ name: String, price: Number, description: String }], default: [] },
    slots_booked: { type: Object, default: {} },
    address: { type: Object, required: true },
    phone: { type: String, default: '' },
    clinicName: { type: String, default: '' },
    date: { type: Number, required: true },
    // reviews and rating
    reviews: { type: [{ userId: String, name: String, rating: Number, comment: String, date: Number }], default: [] },
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
}, { minimize: false })

const doctorModel = mongoose.models.doctor || mongoose.model("doctor", doctorSchema);
export default doctorModel;