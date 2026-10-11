import mongoose from 'mongoose'

const applicationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    role: { type: String, enum: ['doctor', 'lab', 'other'], default: 'doctor' },
    speciality: { type: String },
    qualifications: { type: String },
    resumeLink: { type: String },
    message: { type: String },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
})

const applicationModel = mongoose.model('applications', applicationSchema)

export default applicationModel
