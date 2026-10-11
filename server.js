import express from "express"
import cors from 'cors'
import 'dotenv/config'
import serverless from "serverless-http"

import connectDB from "./config/mongodb.js"
import connectCloudinary from "./config/cloudinary.js"
import userRouter from "./routes/userRoute.js"
import doctorRouter from "./routes/doctorRoute.js"
import labRouter from "./routes/labRoute.js"
import adminRouter from "./routes/adminRoute.js"
import jobRouter from "./routes/jobRoute.js"

const app = express()
const port = process.env.PORT || 4000

connectDB()
connectCloudinary()

app.use(express.json())
app.use(cors())

app.use("/api/user", userRouter)
app.use("/api/admin", adminRouter)
app.use("/api/doctor", doctorRouter)
app.use("/api/lab", labRouter)
app.use("/api/job", jobRouter)

app.get("/", (req, res) => {
  res.send("API Working")
})

app.get('/api/ai/config', (req, res) => {
  res.json({
    assistantName: process.env.ASSISTANT_NAME || 'Chahar',
    userName: process.env.CHAR_USER_NAME || 'Ashish',
    model: process.env.GROQ_MODEL || 'llama-3.3-70B-versatile',
    ttsVoice: process.env.TTS_VOICE || 'en-CA-LiamNeural',
    ttsRate: process.env.TTS_RATE || '+22%'
  })
})

export const handler = serverless(app)

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => console.log(`Server started on PORT:${port}`))
}