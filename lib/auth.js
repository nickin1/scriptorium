import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

export function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' },
    )
}

