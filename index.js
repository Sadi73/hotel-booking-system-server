const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(cors({
    origin: ['http://localhost:3000', 'https://hotel-booking-system-gilt.vercel.app', 'http://192.168.1.12:3000']
}));


const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.jcb8og7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();


        const database = client.db("hotel-management");
        const allRegisteredUser = database.collection("allRegisteredUser");
        const roomCollection = database.collection("rooms");
        const reservationCollection = database.collection("reservations");

        // POST: Register User
        app.post('/register', async (req, res) => {
            const newUser = req.body;
            const query = { email: newUser?.email };
            const userExist = await allRegisteredUser.findOne(query);

            if (userExist?.isVerified) {
                return res.status(409).json({
                    status: 409,
                    message: 'User already exists',
                });
            }

            // Create JWT for email verification (valid for 24 hours)
            const token = jwt.sign({ email: newUser.email }, process.env.SECRET_KEY, { expiresIn: '24h' });
            newUser.verificationToken = token;
            newUser.isVerified = false;
            newUser.role = 'USER';

            const result = userExist
                ? await allRegisteredUser.updateOne(query, { $set: { verificationToken: token } })
                : await allRegisteredUser.insertOne(newUser);

            // Send verification email
            // const verificationLink = `http://yourdomain.com/verify/${token}`;
            const verificationLink = `http://192.168.1.6:4000/verify/${token}`;
            const transporter = nodemailer.createTransport({
                service: 'Gmail', // Or your preferred email service
                auth: {
                    user: 'saditanzim@gmail.com',
                    pass: process.env.APP_PASSWORD,
                },
            });

            const mailOptions = {
                from: 'saditanzim@gmail.com',
                to: newUser.email,
                subject: 'Verify Your Email',
                html: `<p>Click the link below to verify your email:</p>
               <a href="${verificationLink}">${verificationLink}</a>`,
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    return res.status(500).json({
                        status: 500,
                        message: 'Error sending verification email',
                        error: err
                    });
                }

                res.status(201).json({
                    status: 201,
                    message: 'User registered successfully. Please verify your email to complete the registration.',
                    data: result,
                });
            });
        });

        // GET: Verify Email
        app.get('/verify/:token', async (req, res) => {
            const { token } = req.params;

            const user = await allRegisteredUser.findOne({ verificationToken: token });

            if (!user) {
                return res.status(400).json({
                    status: 400,
                    message: 'Invalid or expired verification link',
                });
            }

            // Mark the user as verified
            const result = await allRegisteredUser.updateOne(
                { verificationToken: token },
                { $set: { isVerified: true }, $unset: { verificationToken: '' } }
            );

            if (result?.modifiedCount) {
                return res.status(200).json({
                    status: 200,
                    message: 'Email verified successfully. Registration complete.',
                    result
                });
            } else {
                return res.status(200).json({
                    status: 409,
                    message: 'Email not verified. Please try again',
                    result
                });
            }


        });

        // LOGIN
        app.post('/login', async (req, res) => {
            const user = req?.body;

            const query = { email: user?.email, password: user?.password };

            const registeredUser = await allRegisteredUser.findOne(query);

            if (registeredUser) {
                if (registeredUser?.isVerified) {
                    const token = jwt.sign({
                        data: registeredUser?.email
                    }, process.env.SECRET_KEY, { expiresIn: 60 * 60 });
                    res.send({ success: true, user: registeredUser, token })
                } else {
                    res.status(401).send({ success: false, message: "User not verified" });
                }
            } else {
                res.status(401).send({ success: false, message: "Invalid Email/Password" });
            }

        });

        // GET ALL ROOMS
        app.get('/rooms', async (req, res) => {
            const allRooms = await roomCollection.find().toArray();
            res.send({ data: allRooms })
        });

        // GET SPECIFIC ROOM BY ID
        app.get('/room/:id', async (req, res) => {
            const roomId = req.params.id;
            const query = { _id: new ObjectId(roomId) };
            const roomDetails = await roomCollection.findOne(query);
            res.send({ data: roomDetails })
        });

        // BOOK ROOM
        app.post('/book-room', async (req, res) => {
            const bookRoomDetails = req?.body;
            const result = await reservationCollection.insertOne(bookRoomDetails);
            if (result?.insertedId) {
                res.status(200).json({
                    status: 200,
                    message: 'Room Booked successfully',
                    data: result
                })
            } else {
                res.status(409).json({
                    status: 409,
                    message: 'Something went wrong',
                    data: result
                })
            }
        });

        // GET RESERVATION BY EMAIL
        app.get('/my-reservations', async (req, res) => {
            const userEmail = req?.query?.email;
            const query = { reservedBy: userEmail };
            const result = await reservationCollection.find(query).toArray();
            res.send({ data: result })
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!')
})


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})