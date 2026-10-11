import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import { v2 as cloudinary } from "cloudinary";

// API for doctor Login 
const loginDoctor = async (req, res) => {

    try {

        const { email, password } = req.body
        const user = await doctorModel.findOne({ email, type: 'doctor' })

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

// API to get doctor appointments for doctor panel
const appointmentsDoctor = async (req, res) => {
    try {

        const docId = req.body.docId || req.docId
        const appointments = await appointmentModel.find({ docId })

        res.json({ success: true, appointments })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to cancel appointment for doctor panel
const appointmentCancel = async (req, res) => {
    try {

        const docId = req.body.docId || req.docId
        const { appointmentId } = req.body

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (appointmentData && appointmentData.docId.toString() === docId) {
            await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })
            return res.json({ success: true, message: 'Appointment Cancelled' })
        }

        res.json({ success: false, message: 'Appointment Cancelled' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to mark appointment completed for doctor panel
const appointmentComplete = async (req, res) => {
    try {

        const docId = req.body.docId || req.docId
        const { appointmentId } = req.body

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (appointmentData && appointmentData.docId.toString() === docId) {
            await appointmentModel.findByIdAndUpdate(appointmentId, { isCompleted: true })
            return res.json({ success: true, message: 'Appointment Completed' })
        }

        res.json({ success: false, message: 'Appointment Cancelled' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to save prescription details for an appointment
const savePrescription = async (req, res) => {
    try {
        const docId = req.body.docId || req.docId
        const { appointmentId, prescriptionItems, nextAppointmentDate } = req.body

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.docId.toString() !== docId) {
            return res.json({ success: false, message: 'Unauthorized or appointment not found' })
        }

        const normalizedNextDate = typeof nextAppointmentDate === 'string' ? nextAppointmentDate.trim() : ''
        const updateData = {
            prescriptionItems: Array.isArray(prescriptionItems) ? prescriptionItems : [],
            nextAppointmentDate: normalizedNextDate || appointmentData.nextAppointmentDate || '',
            isCompleted: true
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, updateData)

        if (normalizedNextDate) {
            const existingFollowUp = await appointmentModel.findOne({
                userId: appointmentData.userId,
                docId: appointmentData.docId,
                slotDate: normalizedNextDate,
                slotTime: appointmentData.slotTime,
                cancelled: false
            })

            if (!existingFollowUp) {
                const doctorData = await doctorModel.findById(appointmentData.docId).select('-password')
                if (doctorData) {
                    const followUpDocData = doctorData.toObject ? doctorData.toObject() : { ...doctorData }
                    delete followUpDocData.slots_booked

                    let slotsBooked = doctorData.slots_booked || {}
                    const followUpTime = appointmentData.slotTime || '09:00 AM'
                    if (slotsBooked[normalizedNextDate] && slotsBooked[normalizedNextDate].includes(followUpTime)) {
                        // leave this follow-up unscheduled if the slot is already taken
                    } else {
                        if (slotsBooked[normalizedNextDate]) {
                            slotsBooked[normalizedNextDate].push(followUpTime)
                        } else {
                            slotsBooked[normalizedNextDate] = [followUpTime]
                        }

                        const followUpAppointment = new appointmentModel({
                            userId: appointmentData.userId,
                            docId: appointmentData.docId,
                            slotDate: normalizedNextDate,
                            slotTime: followUpTime,
                            userData: appointmentData.userData,
                            docData: followUpDocData,
                            amount: Number(doctorData.fees || 0),
                            date: Date.now(),
                            cancelled: false,
                            payment: false,
                            isCompleted: false,
                            selectedTests: [],
                            reports: [],
                            prescriptionItems: [],
                            nextAppointmentDate: '',
                        })

                        await followUpAppointment.save()
                        await doctorModel.findByIdAndUpdate(appointmentData.docId, { slots_booked: slotsBooked })
                    }
                }
            }
        }

        res.json({ success: true, message: 'Prescription saved successfully' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to upload lab report for a completed appointment
const uploadReport = async (req, res) => {
    try {
        const docId = req.body.docId || req.docId
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

// API to get all doctors list for Frontend
const doctorList = async (req, res) => {
    try {

        const doctors = await doctorModel.find({}).select(['-password', '-email'])
        res.json({ success: true, doctors })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to change doctor availablity for Admin and Doctor Panel
const changeAvailablity = async (req, res) => {
    try {

        const docId = req.body.docId || req.docId

        const docData = await doctorModel.findById(docId)
        await doctorModel.findByIdAndUpdate(docId, { available: !docData.available })
        res.json({ success: true, message: 'Availablity Changed' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get doctor profile for  Doctor Panel
const doctorProfile = async (req, res) => {
    try {

        const docId = req.body.docId || req.docId
        const profileData = await doctorModel.findById(docId).select('-password')

        res.json({ success: true, profileData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to update doctor profile data from  Doctor Panel
const updateDoctorProfile = async (req, res) => {
    try {

        const { docId, fees, address, available, phone, clinicName, about, availableFrom, availableTo, slotDuration } = req.body
        // address may come as JSON string when using FormData
        const parsedAddress = typeof address === 'string' ? JSON.parse(address) : address
        const updateFields = { fees, address: parsedAddress, available, phone, clinicName, about }
        if (availableFrom !== undefined) updateFields.availableFrom = availableFrom
        if (availableTo !== undefined) updateFields.availableTo = availableTo
        if (slotDuration !== undefined) updateFields.slotDuration = Number(slotDuration)

        // if an image was uploaded, send it to cloudinary and update url
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

// API to get dashboard data for doctor panel
const doctorDashboard = async (req, res) => {
    try {

        const docId = req.body.docId || req.docId

        const appointments = await appointmentModel.find({ docId })

        let earnings = 0

        appointments.map((item) => {
            if (item.isCompleted || item.payment) {
                earnings += item.amount
            }
        })

        let patients = []

        appointments.map((item) => {
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

export {
    loginDoctor,
    appointmentsDoctor,
    appointmentCancel,
    doctorList,
    changeAvailablity,
    appointmentComplete,
    savePrescription,
    uploadReport,
    doctorDashboard,
    doctorProfile,
    updateDoctorProfile
}