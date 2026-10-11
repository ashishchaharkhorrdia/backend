import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import { v2 as cloudinary } from 'cloudinary'
import stripe from "stripe";
import razorpay from 'razorpay';

// Gateway Initialize
const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY)
const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// API to register user
const registerUser = async (req, res) => {

    try {
        const { name, email, password } = req.body;

        // checking for all data to register user
        if (!name || !email || !password) {
            return res.json({ success: false, message: 'Missing Details' })
        }

        // validating email format
        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" })
        }

        // validating strong password
        if (password.length < 8) {
            return res.json({ success: false, message: "Please enter a strong password" })
        }

        // hashing user password
        const salt = await bcrypt.genSalt(10); // the more no. round the more time it will take
        const hashedPassword = await bcrypt.hash(password, salt)

        const userData = {
            name,
            email,
            password: hashedPassword,
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

        res.json({ success: true, token })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to login user
const loginUser = async (req, res) => {

    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email })

        if (!user) {
            return res.json({ success: false, message: "User does not exist" })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
            res.json({ success: true, token })
        }
        else {
            res.json({ success: false, message: "Invalid credentials" })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user profile data
const getProfile = async (req, res) => {

    try {
        const { userId } = req.body
        const userData = await userModel.findById(userId).select('-password')

        res.json({ success: true, userData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to update user profile
const updateProfile = async (req, res) => {

    try {

        const { userId, name, phone, address, dob, gender } = req.body
        const imageFile = req.file

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: "Data Missing" })
        }

        await userModel.findByIdAndUpdate(userId, { name, phone, address: JSON.parse(address), dob, gender })

        if (imageFile) {

            // upload image to cloudinary
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" })
            const imageURL = imageUpload.secure_url

            await userModel.findByIdAndUpdate(userId, { image: imageURL })
        }

        res.json({ success: true, message: 'Profile Updated' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to book appointment 
const bookAppointment = async (req, res) => {

    try {

        const { userId, docId, slotDate, slotTime, selectedTests } = req.body
        const docData = await doctorModel.findById(docId).select("-password")

        if (!docData.available) {
            return res.json({ success: false, message: 'Provider Not Available' })
        }

        let slots_booked = docData.slots_booked

        // checking for slot availability with capacity limit (6 per slot)
        const SLOT_CAPACITY = 6
        const formattedStart = slotTime && slotTime.includes('-') ? slotTime.split('-')[0].trim() : slotTime

        if (!slots_booked[slotDate]) {
            slots_booked[slotDate] = []
        }

        // count existing bookings that match the exact range or the start-time format
        const existingCount = slots_booked[slotDate].filter(s => s === slotTime || s === formattedStart).length

        if (existingCount >= SLOT_CAPACITY) {
            return res.json({ success: false, message: 'Slot Not Available' })
        }

        // add this booking (store as the range string)
        slots_booked[slotDate].push(slotTime)

        const userData = await userModel.findById(userId).select("-password")

        delete docData.slots_booked

        let amount = docData.fees
        let tests = []

        if (docData.type === 'lab') {
            if (!Array.isArray(selectedTests) || !selectedTests.length) {
                return res.json({ success: false, message: 'Please select at least one lab test' })
            }

            const availableTests = docData.tests.map(test => ({ name: test.name, price: Number(test.price), description: test.description }))
            const matchedTests = []
            let total = 0

            for (const selected of selectedTests) {
                const foundTest = availableTests.find(test => test.name === selected.name)
                if (!foundTest) {
                    return res.json({ success: false, message: `Invalid test selected: ${selected.name}` })
                }
                if (Number(selected.price) !== Number(foundTest.price)) {
                    return res.json({ success: false, message: `Test price mismatch for ${selected.name}` })
                }
                matchedTests.push(foundTest)
                total += foundTest.price
            }

            amount = Number(docData.fees || 0) + total
            tests = matchedTests
        }

        const appointmentData = {
            userId,
            docId,
            userData,
            docData,
            amount,
            selectedTests: tests,
            slotTime,
            slotDate,
            date: Date.now()
        }

        const newAppointment = new appointmentModel(appointmentData)
        await newAppointment.save()

        // save new slots data in docData
        await doctorModel.findByIdAndUpdate(docId, { slots_booked })

        res.json({ success: true, message: 'Appointment Booked' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to cancel appointment
const cancelAppointment = async (req, res) => {
    try {

        const { userId, appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        // verify appointment user 
        if (appointmentData.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })

        // releasing doctor slot 
        const { docId, slotDate, slotTime } = appointmentData

        const doctorData = await doctorModel.findById(docId)

        let slots_booked = doctorData.slots_booked

        // remove only one occurrence of the booked slot (do not remove all matching entries)
        if (slots_booked[slotDate]) {
            const idx = slots_booked[slotDate].indexOf(slotTime)
            if (idx > -1) {
                slots_booked[slotDate].splice(idx, 1)
            } else {
                // try matching by start-time format if exact range not found
                const startOnly = slotTime && slotTime.includes('-') ? slotTime.split('-')[0].trim() : slotTime
                const idx2 = slots_booked[slotDate].indexOf(startOnly)
                if (idx2 > -1) slots_booked[slotDate].splice(idx2, 1)
            }
        }

        await doctorModel.findByIdAndUpdate(docId, { slots_booked })

        res.json({ success: true, message: 'Appointment Cancelled' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user appointments for frontend my-appointments page
const listAppointment = async (req, res) => {
    try {

        const { userId } = req.body
        const appointments = await appointmentModel.find({ userId })

        res.json({ success: true, appointments })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to make payment of appointment using razorpay
const paymentRazorpay = async (req, res) => {
    try {

        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled or not found' })
        }

        // creating options for razorpay payment
        const options = {
            amount: appointmentData.amount * 100,
            currency: process.env.CURRENCY,
            receipt: appointmentId,
        }

        // creation of an order
        const order = await razorpayInstance.orders.create(options)

        res.json({ success: true, order })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to verify payment of razorpay
const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id } = req.body
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)

        if (orderInfo.status === 'paid') {
            await appointmentModel.findByIdAndUpdate(orderInfo.receipt, { payment: true })
            res.json({ success: true, message: "Payment Successful" })
        }
        else {
            res.json({ success: false, message: 'Payment Failed' })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to make payment of appointment using Stripe
const paymentStripe = async (req, res) => {
    try {

        const { appointmentId } = req.body
        const { origin } = req.headers

        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled or not found' })
        }

        const currency = process.env.CURRENCY.toLocaleLowerCase()

        const line_items = [{
            price_data: {
                currency,
                product_data: {
                    name: "Appointment Fees"
                },
                unit_amount: appointmentData.amount * 100
            },
            quantity: 1
        }]

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/verify?success=true&appointmentId=${appointmentData._id}`,
            cancel_url: `${origin}/verify?success=false&appointmentId=${appointmentData._id}`,
            line_items: line_items,
            mode: 'payment',
        })

        res.json({ success: true, session_url: session.url });

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const verifyStripe = async (req, res) => {
    try {

        const { appointmentId, success } = req.body

        if (success === "true") {
            await appointmentModel.findByIdAndUpdate(appointmentId, { payment: true })
            return res.json({ success: true, message: 'Payment Successful' })
        }

        res.json({ success: false, message: 'Payment Failed' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to add review for a doctor after appointment
const addReview = async (req, res) => {
    try {
        const { userId, appointmentId, docId, rating, comment } = req.body

        if (!appointmentId || !docId || !rating) {
            return res.json({ success: false, message: 'Missing data' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData) return res.json({ success: false, message: 'Appointment not found' })

        if (appointmentData.userId !== userId) return res.json({ success: false, message: 'Unauthorized' })

        if (!appointmentData.isCompleted) return res.json({ success: false, message: 'Only completed appointments can be reviewed' })

        if (appointmentData.reviewed) return res.json({ success: false, message: 'Already reviewed' })

        const userData = appointmentData.userData || await userModel.findById(userId).select('-password')

        const reviewItem = {
            userId,
            name: (userData && userData.name) ? userData.name : '',
            rating: Number(rating),
            comment: comment || '',
            date: Date.now()
        }

        const doctorData = await doctorModel.findById(docId)
        if (!doctorData) return res.json({ success: false, message: 'Doctor not found' })

        // push review
        await doctorModel.findByIdAndUpdate(docId, {
            $push: { reviews: reviewItem }
        })

        // update aggregated rating
        const newReviewsCount = (doctorData.reviewsCount || 0) + 1
        const prevTotal = (doctorData.rating || 0) * (doctorData.reviewsCount || 0)
        const newRating = (prevTotal + Number(rating)) / newReviewsCount

        await doctorModel.findByIdAndUpdate(docId, { rating: newRating, reviewsCount: newReviewsCount })

        // mark appointment as reviewed
        await appointmentModel.findByIdAndUpdate(appointmentId, { reviewed: true })

        res.json({ success: true, message: 'Review added' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export {
    loginUser,
    registerUser,
    getProfile,
    updateProfile,
    bookAppointment,
    listAppointment,
    cancelAppointment,
    paymentRazorpay,
    verifyRazorpay,
    paymentStripe,
    verifyStripe
    , addReview
}
