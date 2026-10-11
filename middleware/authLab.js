import jwt from 'jsonwebtoken'

// lab authentication middleware
const authLab = async (req, res, next) => {
    const { ltoken } = req.headers
    if (!ltoken) {
        return res.json({ success: false, message: 'Not Authorized Login Again' })
    }
    try {
        const token_decode = jwt.verify(ltoken, process.env.JWT_SECRET)
        // attach lab id to request object instead of req.body to avoid multer overwriting it
        req.labId = token_decode.id
        next()
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export default authLab;
