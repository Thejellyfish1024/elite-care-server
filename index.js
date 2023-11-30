const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken')
const app = express()
const port = process.env.port || 5000
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


// middlewares

app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.s79pxyc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const database = client.db('eliteCareDB');
const userCollection = database.collection('users');
const campsCollection = database.collection('medicalCamps');
const popularCollection = database.collection('popularCamps');
const participantCollection = database.collection('participants')
const upcomingParticipantCollection = database.collection('upcomingParticipants')
const upcomingCampsCollection = database.collection('upcomingCamps')
const interestedProfessionalCollection = database.collection('interestedProfessionals')
const paymentCollection = database.collection('payments')
const reviewCollection = database.collection('reviews')

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // authentication

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'
      });
      res.send({ token })
    })

    const verifyToken = (req, res, next) => {
      // console.log('hitting');
      if (!req.headers?.authorization) {
        console.log('authorization error');
        return res.status(401).send({ message: 'unauthorized access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    const verifyOrganizer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isOrganizer = user?.role === 'organizer';
      if (!isOrganizer) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();
    }

    app.get('/users/organizer/:email',verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log('decoded', req?.decoded?.email);
      if (email !== req?.decoded?.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query)
      let organizer = false;
      if (user) {
        organizer = user?.role === 'organizer'
      }
      // console.log('organizer', organizer);
      res.send({ organizer })
    })
    app.get('/users/professional/:email',verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log('decoded', req?.decoded?.email);
      if (email !== req?.decoded?.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query)
      let professional = false;
      if (user) {
        professional = user?.role === 'professional'
      }
      res.send({ professional })
    })

    // 

    // payments

    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({ clientSecret: paymentIntent.client_secret })
    })


    app.post('/payments/:id', async (req, res) => {
      const payment = req.body;
      const id = req.params.id;
      const paymentResult = await paymentCollection.insertOne(payment)

      const query = {_id : new ObjectId(id)}
      const updatedPayment = {
        $set : {payment : 'paid'}
      }
      const updateResult = await participantCollection.updateOne(query,updatedPayment)
  
      res.send({paymentResult, updateResult})

    })

    app.get('/payments/:email',verifyToken, async(req,res) =>{
      const email = req.params.email;
      const query = { email : email }
      const result = await paymentCollection.find(query).toArray()
      res.send(result);
    })

    app.get('/payment-history/:email', async(req,res) =>{
      const email = req.params.email;
      const query = {email : email}
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    // 


    app.get('/popular-camps', async (req, res) => {
      const result = await popularCollection.find().toArray()
      res.send(result)
    })

    app.get('/camp-details/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await campsCollection.findOne(query)
      res.send(result)
    })

    app.get('/upcoming-camp-details/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await upcomingCampsCollection.findOne(query)
      res.send(result)
    })

    app.get('/registration-stat/:id', async (req, res) => {
      const campId = req.params?.id;
      const query = { campId: campId };
      const registrations = await participantCollection.find(query).toArray();
      const totalRegistration = registrations?.length;
      res.send({ totalRegistration: totalRegistration });
    })
    app.get('/upcoming-registration-stat/:id', async (req, res) => {
      const campId = req.params?.id;
      const query = { campId: campId };
      const registrations = await upcomingParticipantCollection.find(query).toArray();
      const totalUpcomingRegistration = registrations?.length;
      res.send({ totalUpcomingRegistration: totalUpcomingRegistration });
    })

    app.get('/professional-stat/:id', async (req, res) => {
      const campId = req.params?.id;
      const query = { campId: campId };
      const professionals = await interestedProfessionalCollection.find(query).toArray();
      const totalProfessionals = professionals?.length;
      res.send({ totalProfessionals: totalProfessionals });
    })

    


    app.post('/medical-camps', verifyToken, verifyOrganizer, async (req, res) => {
      const newCamp = req.body;
      const result = await campsCollection.insertOne(newCamp);
      res.send(result)
    })


    app.post('/upcoming-camps', verifyToken, verifyOrganizer, async (req, res) => {
      const newCamp = req.body;
      const result = await upcomingCampsCollection.insertOne(newCamp);
      res.send(result)
    })

    app.get('/upcoming-camps', async(req,res) =>{
      const result = await upcomingCampsCollection.find().toArray()
      res.send(result)
    })

    app.get('/upcoming-camps/:organizerEmail',verifyToken,verifyOrganizer, async(req,res) =>{
      const organizerEmail = req.params.organizerEmail;
      const query = {organizerEmail : organizerEmail}
      const result = await upcomingCampsCollection.find(query).toArray()
      res.send(result)
    })


    app.delete('/medical-camps/:id',verifyToken,verifyOrganizer, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await campsCollection.deleteOne(query)
      res.send(result)
    })

    app.delete('/upcoming-camps/:id',verifyToken,verifyOrganizer, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await upcomingCampsCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/medical-camps/:organizerEmail', async (req, res) => {
      const organizerEmail = req.params.organizerEmail;
      const query = { organizerEmail: organizerEmail }
      const result = await campsCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/medical-camp/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id : new ObjectId(id) }
      const result = await campsCollection.findOne(query)
      res.send(result)
    })

    app.post('/reviews', async(req,res) =>{
      const newReview = req.body;
      const result = await reviewCollection.insertOne(newReview);
      res.send(result);
    })

    app.get('/reviews', async(req,res) =>{
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })

    app.patch('/medical-camps/:id',verifyToken,verifyOrganizer, async (req, res) => {
      const id = req.params.id;
      const updatedCamp = {
        $set: req.body
      }
      const filter = { _id: new ObjectId(id) };
      const result = await campsCollection.updateOne(filter, updatedCamp);
      res.send(result)
    })

    app.get('/medical-camp/:id', async(req,res) =>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await campsCollection.findOne(query)
      res.send(result)
    })

    app.get('/available-camps', async(req,res) =>{
      const result = await campsCollection.find().toArray();
      res.send(result);
    })

    app.get('/users/:email',  async (req, res) => {
      // console.log('aisi');
      const email = req.params.email;
      const query = { email: email }
      const result = await userCollection.findOne(query);
      res.send(result);
    })

    app.get('/registered-camps/:email', verifyToken, async(req,res) =>{
      const email = req.params.email;
      const query = { email : email};
      const result = await participantCollection.find(query).toArray();
      res.send(result);
    })

    app.delete('/registered-camp/:id', async(req,res) =>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await participantCollection.deleteOne(query);
      res.send(result);
    })

  

    app.put('/users/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const updatedProfile = {
        $set: req.body
      }
      const filter = { email: email };
      const options = { upsert: true };
      const result = await userCollection.updateOne(filter, updatedProfile, options);
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exist', insertedId: null });
      }
      const result = await userCollection.insertOne(user)
      res.send(result);
    })

    app.post('/registered-participants',verifyToken, async (req, res) => {
      const newEntry = req.body;
      const result = await participantCollection.insertOne(newEntry);
      res.send(result);
    })


    app.post('/upcoming-registered-participants',verifyToken, async (req, res) => {
      const newEntry = req.body;
      const result = await upcomingParticipantCollection.insertOne(newEntry);
      res.send(result);

    })

    app.post('/interested-professionals',verifyToken, async(req,res) =>{
      const professionalInfo = req.body;
      const result = await interestedProfessionalCollection.insertOne(professionalInfo);
      res.send(result);
    })

    app.patch('/registered-participants/:id',verifyToken,verifyOrganizer, async(req,res) =>{
      const id = req.params.id;
      const filter = {_id : new ObjectId(id)}
      const updatedStatus = {
        $set : {status : 'confirmed'}
      }
      const result = await participantCollection.updateOne(filter, updatedStatus);
      res.send(result)
    })

    app.get('/registered-participants/:organizerEmail', verifyToken,verifyOrganizer,async (req,res) =>{
      const organizerEmail = req?.params.organizerEmail;
      const query = {organizerEmail : organizerEmail};
      const result = await participantCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/registered-participant/:id', verifyToken,async (req,res) =>{
      const id = req?.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await participantCollection.findOne(query)
      res.send(result)
    })

    app.get('/upcoming-registered-participants/:organizerEmail', verifyToken,verifyOrganizer,async (req,res) =>{
      const organizerEmail = req?.params.organizerEmail;
      const query = {organizerEmail : organizerEmail};
      const result = await upcomingParticipantCollection.find(query).toArray()
      res.send(result)
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