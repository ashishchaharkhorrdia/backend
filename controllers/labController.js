import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import { v2 as cloudinary } from "cloudinary";

const loginLab = async (req, res) => {
    try {
        const { email, password } = req.body
        const user = await doctorModel.findOne({ email, type: 'lab' })

        if (!user) {
            return res.json({ success: false, message: "Invalid credentials" })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
            res.json({ success: true, token })
        } else {
            res.json({ success: false, message: "Invalid credentials" })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const appointmentsLab = async (req, res) => {
    try {
        const docId = req.body.docId || req.labId
        const appointments = await appointmentModel.find({ docId })
        res.json({ success: true, appointments })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const appointmentCancel = async (req, res) => {
    try {
        const docId = req.body.docId || req.labId
        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)
        if (appointmentData && appointmentData.docId.toString() === docId) {
            await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })
            return res.json({ success: true, message: 'Appointment Cancelled' })
        }
        res.json({ success: false, message: 'Appointment not found or unauthorized' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const appointmentComplete = async (req, res) => {
    try {
        const docId = req.body.docId || req.labId
        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)
        if (appointmentData && appointmentData.docId.toString() === docId) {
            await appointmentModel.findByIdAndUpdate(appointmentId, { isCompleted: true })
            return res.json({ success: true, message: 'Appointment Completed' })
        }
        res.json({ success: false, message: 'Appointment not found or unauthorized' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const labDashboard = async (req, res) => {
    try {
        const docId = req.body.docId || req.labId
        const appointments = await appointmentModel.find({ docId })
        let earnings = 0
        let patients = []
        appointments.forEach((item) => {
            if (item.isCompleted || item.payment) {
                earnings += item.amount
            }
            if (!patients.includes(item.userId)) {
                patients.push(item.userId)
            }
        })

        const dashData = {
            earnings,
            appointments: appointments.length,
            patients: patients.length,
            latestAppointments: appointments.reverse()
        }

        res.json({ success: true, dashData })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const labProfile = async (req, res) => {
    try {
        const docId = req.body.docId || req.labId
        const profileData = await doctorModel.findById(docId).select('-password')
        res.json({ success: true, profileData })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const updateLabProfile = async (req, res) => {
    try {
        const docId = req.body.docId || req.labId
        const { fees, address, available, phone, clinicName, about } = req.body
        const parsedAddress = typeof address === 'string' ? JSON.parse(address) : address
        const updateFields = { fees, address: parsedAddress, available, phone, clinicName, about }

        if (req.file) {
            const imageUpload = await cloudinary.uploader.upload(req.file.path, { resource_type: "image" })
            updateFields.image = imageUpload.secure_url
        }

        await doctorModel.findByIdAndUpdate(docId, updateFields)
        res.json({ success: true, message: 'Profile Updated' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const uploadReport = async (req, res) => {
    try {
        const docId = req.body.docId || req.labId
        const { appointmentId, notes } = req.body
        const file = req.file
        if (!file) {
            return res.json({ success: false, message: 'Report file is required' })
        }
        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.docId.toString() !== docId) {
            return res.json({ success: false, message: 'Appointment not found or unauthorized' })
        }
        const imageUpload = await cloudinary.uploader.upload(file.path, { resource_type: 'auto' })
        const reportItem = {
            url: imageUpload.secure_url,
            filename: file.originalname,
            notes: notes || '',
            date: Date.now()
        }
        await appointmentModel.findByIdAndUpdate(appointmentId, {
            $push: { reports: reportItem },
            isCompleted: true
        })
        res.json({ success: true, message: 'Report uploaded successfully' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export {
    loginLab,
    appointmentsLab,
    appointmentCancel,
    appointmentComplete,
    labDashboard,
    labProfile,
    updateLabProfile,
    uploadReport
}
