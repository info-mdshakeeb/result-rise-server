const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const port = process.env.PORT || 3100;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const uri = `mongodb+srv://result-rise-db-user:8atFxiIp8yCahDc6@result-rise-db.g6bidmr.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);
// middleware
app.use(cors());
app.use(express.json());
const http = require("http");
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});
let users = [];

const addUser = (userEmail, socketId, userInfo) => {
    const checkUser = users.some(u => u.userEmail === userEmail)
    if (!checkUser) {
        users.push({ userEmail, socketId, userInfo })
    }
}
const removeUser = (socketId) => {
    users = users.filter(u => u.socketId !== socketId)
}
const findFriend = (id) => {
    return users.find(u => u.userEmail === id)
}
io.on('connection', (socket) => {
    console.log('user connected');
    socket.on("addUsers", (userEmail, userInfo) => {
        addUser(userEmail, socket.id, userInfo)
        io.emit("getUser", users);
        socket.emit("connected");
    })
    socket.on("sendMessage", (data) => {
        const user = findFriend(data.receiverid);
        console.log('send message server data', data);
        if (user !== undefined) {
            socket.to(user.socketId).emit("getMessage", {
                senderEmail: data.senderEmail,
                senderName: data.senderName,
                senderPhoto: data.senderPhoto,
                time: data.time,
                receiverid: data.receiverid,
                message: data.message
            })
        }
    })
    socket.on('disconnect', () => {
        console.log('user disconnected');
        removeUser(socket.id);
        io.emit("getUser", users)
    })
})
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});
const mongodb = () => {
    try {
        client.connect()
        console.log('database connected');
    }
    catch (error) { console.log(error.message); }
}
mongodb()
//collections
const db = client.db("result-rise");
const usersCollection = db.collection("users");
const studentResult = db.collection("studentResultData")
const studentsReportCollection = db.collection("studentsReport")
const NoticeCollection = db.collection('notices')
const messageCollection = db.collection("allMessages");

// post a user
app.post("/users", async (req, res) => {
    const user = req.body
    // console.log(user);
    const result = await usersCollection.insertOne(user);
    res.send(result);
});
// user a delete 
app.delete("/users/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const result = await usersCollection.deleteOne(query);
    res.send(result);
});
// update user
app.put("/users/:id", async (req, res) => {
    const id = req.params.id;
    const updateProfile = req.body;
    const filter = { _id: ObjectId(id) };
    const options = { upsert: true };
    const updatedUser = {
        $set: {
            name: updateProfile.name,
            phone: updateProfile.phone,
            address: updateProfile.address,
            verification: false,
        }
    }
    // console.log("UP:", updatedUser)
    const result = await usersCollection.updateOne(filter, updatedUser, options);
    res.send(result)
    // console.log("UP:", updatedUser)
});
//get a user by email
app.get("/users/:email", async (req, res) => {
    const { email } = req.params;
    const query = { email: email };
    try {
        const user = await usersCollection.find(query).toArray()
        res.send(user);
    } catch (error) { res.send(error.message); }
});
//get a user by id 
app.get("/users/:id", async (req, res) => {
    const { id } = req.params;
    const query = { _id: ObjectId(id) };
    const user = await usersCollection.findOne(query)
    res.send(user);
});
// Verification student and teacher
app.patch("/users/:id", async (req, res) => {
    const id = req.params.id;
    const filter = { _id: ObjectId(id) };

    // const user = req.body;
    const options = { upsert: true };
    const updatedUser = {
        $set: {
            verification: true,
        }
    }
    // console.log("UP:", updatedUser)
    const result = await usersCollection.updateOne(filter, updatedUser, options);
    res.send(result)
    // console.log("UP:", updatedUser)
});
//get all pending  form user
app.get("/pending/:roll", async (req, res) => {
    const { roll } = req.params;
    const query = { verification: false };
    const users = await usersCollection.find(query).toArray();
    try {
        if (roll === "student") {
            const students = users.filter(user => user.roll === "student");
            // console.log("student", students);
            res.send(students);
            return;
        }
        else if (roll === "teacher") {
            const teacher = users.filter(user => user.roll === "teacher");
            res.send(teacher);
            return;
        }
        else { res.send("user not found"); }
    } catch (error) { res.send(error.message); }
});
// get all verified user
app.get("/verified/:roll", async (req, res) => {
    const { roll } = req.params;
    const query = { verification: true };
    const users = await usersCollection.find(query).toArray();
    try {
        if (roll === "student") {
            const students = users.filter(user => user.roll === "student");
            // console.log("student", students);
            res.send(students);
            return;
        }
        else if (roll === "teacher") {
            const teacher = users.filter(user => user.roll === "teacher");
            res.send(teacher);
            return;
        }
        else { res.send("user not found"); }
    } catch (error) { res.send(error.message); }
});
// get my reports 
app.get("/myreports/:email", async (req, res) => {
    const { email } = req.params;
    const query = { email };
    try {
        const user = await usersCollection.findOne(query)
        const reports = await studentsReportCollection.find({ reporterEmail: user.email }).toArray();
        res.send(reports);
    } catch (error) { res.send(error.message); }
});
// student report posted 
app.post("/report", async (req, res) => {
    const reportData = req.body;
    // console.log(reportData);
    const result = await studentsReportCollection.insertOne(reportData);
    res.send(result);
});
// get all student reports
app.get("/reports/:type", async (req, res) => {
    const { type } = req.params;
    // console.log(type);
    let query = {};
    try {
        if (type === "all") {
            const reports = await studentsReportCollection.find(query).toArray();
            res.send(reports);
        }
        else if (type === "pending") {
            query = { resolved: false };
            const reports = await studentsReportCollection.find(query).toArray();
            res.send(reports);
        }
        else if (type === "resolved") {
            query = { resolved: true };
            const reports = await studentsReportCollection.find(query).toArray();
            res.send(reports);
        }
        else { res.send("user not found"); }
    } catch (error) {
        res.send(error.message);
    }
});
//get a query students :

app.get("/students", async (req, res) => {
    const { admission, department, subject } = req.query;
    // console.log(admission, department, subject);
    const query = { admissions: admission };
    const students = await studentResult.find(query).toArray();
    console.log(students);
    res.send(students);
});

//update a student result
app.put("/addResult/:id", async (req, res) => {
    const { id } = req.params;
    const studentResult = req.body;
    console.log(id, studentResult);
    // const filter = { id: id };
    // const options = { upsert: true };
    // const updatedDoc = {
    //     $set: {
    //         resolved: true,
    //         result: studentResult,
    //     }
    // }
    // const result = await studentResult.updateOne(filter, updatedDoc, options);
    // res.send(result)
});

// delete a reportData :
app.delete("/reports/:id", async (req, res) => {
    const { id } = req.params;
    const query = { _id: ObjectId(id) };
    const result = await studentsReportCollection.deleteOne(query);
    res.send(result);
});

app.put("/resolved/:id", async (req, res) => {
    const id = req.params.id;
    const filter = { _id: ObjectId(id) };
    const options = { upsert: true };
    const updatedDoc = {
        $set: {
            resolved: true,
        }
    }
    const result = await studentsReportCollection.updateOne(filter, updatedDoc, options);
    res.send(result);
});
// get result form outside Login
app.post('/students/outsied', async (req, res) => {
    const { id, registration, department, semister } = req.body;
    console.log('details', id, registration, department, semister);
    const query = { student_id: id, registration_number: registration, department };
    try {
        const student = await studentResult.findOne(query);
        if (!student) {
            return res.status(404).send('student not found');
        }
        const semesterData = student?.semester_results?.find(s => s.semester == semister);
        if (!semesterData) {
            return res.status(404).send('Semester not found');
        }
        res.send(semesterData);
    } catch (error) {
        res.send(error.message);
    }
});

//result data
app.get("/resultdata", async (req, res) => {
    const email = req.query.email;
    // console.log('result data email', email);
    const query = { student_email: email };
    const resultData = await studentResult.find(query);
    const result = await resultData.toArray()
    // console.log(result);
    res.send(result);
});

app.get("/resultdata/:id", async (req, res) => {
    const email = req.query.email;
    // console.log('result data email', email);
    const id = req.params.id;
    const query = { student_email: email };
    const student = await studentResult.findOne(query);
    // console.log("student data ", student);
    if (student) {
        const semesterResult = student?.semester_results?.find(
            (st) => st.semesterId == id
        );
        // console.log("studentresult data ", semesterResult);
        res.send(semesterResult);
    }
});
// post a notice :
app.post("/notice", async (req, res) => {
    const formData = req.body;
    try {
        const result = await NoticeCollection.insertOne(formData);
        res.send(result);
    } catch (error) { res.send(error.message); }

});
// get all notice :
app.get("/notice", async (req, res) => {
    const query = {};
    const noticeData = await NoticeCollection.find(query);
    const notice = await noticeData.toArray();
    // console.log('notice data', notice);
    res.send(notice);
});

app.get("/", (req, res) => {
    res.send("ResultRise Server is running");
});
//socket io :
//send message
app.post("/message", async (req, res) => {
    const msg = req.body;
    try {
        const result = await messageCollection.insertOne(msg);
        console.log('send message', result);
        res.send(result);
    } catch (error) {
        res.send(error.message);
    }
});
app.get("/message/:senderEmail/:receiverEmail", async (req, res) => {
    const senderEmail = req.params.senderEmail;
    const receiverId = req.params.receiverEmail;
    try {
        let getAllmessage = await messageCollection.find({}).toArray();
        getAllmessage = getAllmessage.filter(
            (m) =>
                (m.senderEmail === senderEmail && m.receiverid === receiverId) ||
                (m.receiverid === senderEmail && m.senderEmail === receiverId)
        );
        res.send(getAllmessage);
    } catch (error) {
        res.send(error.message);
    }
});


httpServer.listen(port, () => {
    console.log("Listening to port", port);
});
