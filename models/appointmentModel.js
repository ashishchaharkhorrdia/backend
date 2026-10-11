import mongoose from "mongoose"

const appointmentSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    docId: { type: String, required: true },
    slotDate: { type: String, required: true },
    slotTime: { type: String, required: true },
    userData: { type: Object, required: true },
    docData: { type: Object, required: true },
    amount: { type: Number, required: true },
    date: { type: Number, required: true },
    cancelled: { type: Boolean, default: false },
    payment: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false },
    selectedTests: { type: [Object], default: [] },
    reports: [{
        url: { type: String, default: '' },
        filename: { type: String, default: '' },
        notes: { type: String, default: '' },
        date: { type: Number, default: Date.now }
    }],
    prescriptionItems: [{
        name: { type: String, default: '' },
        days: { type: String, default: '' },
        time: { type: String, default: '' },
        food: { type: String, default: '' }
    }],
    nextAppointmentDate: { type: String, default: '' }
    , reviewed: { type: Boolean, default: false }
})


const appointmentModel = mongoose.models.appointment || mongoose.model("appointment", appointmentSchema)
export default appointmentModel