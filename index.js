const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(cors({
    origin: ['http://localhost:3000', 'https://hotel-booking-system-gilt.vercel.app']
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
        const database = client.db("hotel-management");
        const allRegisteredUser = database.collection("allRegisteredUser");
        const roomCollection = database.collection("rooms");
        const reservationCollection = database.collection("reservations");

        // REGISTER
        app.post('/register', async (req, res) => {
            const newUser = req.body;
            delete newUser.confirmPassword;
            const query = { email: newUser?.email };
            const userExist = await allRegisteredUser.findOne(query);
            if (userExist) {
                return res.status(409).json({
                    status: 409,
                    message: 'User already exists',
                    user: userExist // Optionally include existing user data if relevant
                });
            } else {
                const result = await allRegisteredUser.insertOne(newUser);

                // Respond with a success message and status
                res.status(201).json({
                    status: 201,
                    message: 'User registered successfully',
                    data: result
                })
            }
        });

        // LOGIN
        app.post('/login', async (req, res) => {
            const user = req?.body;
            const query = { email: user?.email, password: user?.password };
            const registeredUser = await allRegisteredUser.findOne(query);
            if (registeredUser) {
                const token = jwt.sign({
                    data: registeredUser?.email
                }, process.env.SECRET_KEY, { expiresIn: 60 * 60 });
                res.send({ success: true, user: registeredUser, token })
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
        });

        // ADD ROOM
        app.post('/add-new-room', async (req, res) => {
            const newRoom = req?.body;
            const result = await roomCollection.insertOne(newRoom);
            if (result?.insertedId) {
                res.status(200).json({
                    status: 200,
                    message: 'New room created',
                    data: result
                })
            } else {
                res.status(409).json({
                    status: 409,
                    message: 'Something went wrong',
                    data: result
                })
            }
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