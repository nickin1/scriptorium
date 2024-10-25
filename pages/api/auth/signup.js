import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcryptjs'
import { generateToken } from "../../../lib/auth";

const prisma = new PrismaClient()

export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed.' })
    }

    try {

        const { email, password, firstName, lastName, phoneNumber } = req.body;

        if (!email || !password || !firstName || !lastName || !phoneNumber) {
            return res.status(400).json({ error: 'Missing required fields' })
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' })
        }

        const hashed = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashed,
                firstName,
                lastName,
                phoneNumber,
            },
        });

        const token = generateToken(newUser)

        res.status(201).json({
            message: 'Signed up successfully',
            token
        })
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' })
    }
    finally {
        await prisma.$disconnect()
    }

}
