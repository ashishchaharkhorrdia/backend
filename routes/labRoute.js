import express from 'express';
import authLab from '../middleware/authLab.js';
import upload from '../middleware/multer.js';
import {
    loginLab,
    appointmentsLab,
    appointmentCancel,
    appointmentComplete,
    labDashboard,
    labProfile,
    updateLabProfile,
    uploadReport
} from '../controllers/labController.js';

const labRouter = express.Router();

labRouter.post('/login', loginLab);
labRouter.get('/appointments', authLab, appointmentsLab);
labRouter.post('/cancel-appointment', authLab, appointmentCancel);
labRouter.post('/complete-appointment', authLab, appointmentComplete);
labRouter.get('/dashboard', authLab, labDashboard);
labRouter.get('/profile', authLab, labProfile);
labRouter.post('/update-profile', authLab, upload.single('image'), updateLabProfile);
labRouter.post('/upload-report', authLab, upload.single('report'), uploadReport);

export default labRouter;
