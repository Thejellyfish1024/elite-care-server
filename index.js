const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express()
const port = process.env.port || 5000


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
const participantCollection = database.collection('participants')

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    app.get('/popularCamps', async (req, res) => {
      const result = await campsCollection.find().toArray()
      res.send(result)
    })
    app.get('/camp-details/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id : new ObjectId(id)
      }
      const result = await campsCollection.findOne(query)
      res.send(result)
    })

    app.get('/registration-stat/:id', async(req, res) =>{
      const campId = req.params?.id;
      const query = {campId : campId};
      const registrations = await participantCollection.find(query).toArray();
      const totalRegistration = registrations?.length;
      res.send({totalRegistration : totalRegistration});
    })

    app.post('/medical-camps', async(req, res) =>{
      const newCamp = req.body;
      const result = await campsCollection.insertOne(newCamp);
      res.send(result)
    })

    app.delete('/medical-camps/:id', async(req,res) =>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await campsCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/medical-camps/:organizerEmail', async(req,res) =>{
      const organizerEmail = req.params.organizerEmail;
      const query = {organizerEmail : organizerEmail}
      const result = await campsCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/users/:email', async(req,res) =>{
      const email = req.params.email;
      const query = {email : email}
      const result = await userCollection.findOne(query);
      res.send(result);
    })

    app.put('/users/:email', async(req,res) =>{
      const email = req.params.email;
      const updatedProfile = {
        $set : req.body
      }
      const filter = {email : email};
      const options = {upsert: true};
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

    app.post('/registered-participants', async(req, res) =>{
      const newEntry = req.body;
      // const emailQuery = {email : newEntry?.email};
      // const campIdQuery = {campId : newEntry?.campId};
      // const isEmail = await participantCollection.findOne(emailQuery);
      // const isCampId = await participantCollection.findOne(campIdQuery);
      const result = await participantCollection.insertOne(newEntry);
      res.send(result);
      
    })







    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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