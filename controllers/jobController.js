import applicationModel from '../models/applicationModel.js'

// public apply endpoint
export const applyForPosition = async (req, res) => {
    try {
        const { name, email, phone, role, speciality, qualifications, resumeLink, message } = req.body

        if (!name || !email || !role) {
            return res.json({ success: false, message: 'Missing required fields' })
        }

        const app = new applicationModel({ name, email, phone, role, speciality, qualifications, resumeLink, message })
        await app.save()

        res.json({ success: true, message: 'Application submitted' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// admin: list all applications
export const listApplications = async (req, res) => {
    try {
        const apps = await applicationModel.find().sort({ createdAt: -1 })
        res.json({ success: true, applications: apps })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}
