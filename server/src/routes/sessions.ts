import express from 'express'
import Session from '../models/Session'
import { protect, AuthRequest } from '../middleware/auth'

const router = express.Router()

// Save a session
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { text, keystrokeStats, pasteCount } = req.body

    const session = await Session.create({
      userId: req.userId,
      text,
      keystrokeStats,
      pasteCount,
    })

    res.status(201).json(session)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

// Get all sessions for logged in user
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const sessions = await Session.find({ userId: req.userId }).sort({ createdAt: -1 })
    res.json(sessions)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

export default router