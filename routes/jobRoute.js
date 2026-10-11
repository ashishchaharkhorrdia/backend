import express from 'express'
import { applyForPosition, listApplications } from '../controllers/jobController.js'
import authAdmin from '../middleware/authAdmin.js'

const router = express.Router()

// public apply
router.post('/apply', applyForPosition)

// admin list
router.get('/list', authAdmin, listApplications)

export default router
