const express = require("express")
const bodyParser= require('body-parser')
const cors = require('cors')
const multer = require('multer');
const { MongoClient, ObjectID } = require("mongodb")
const fs = require('fs');
const path = require('path');
const helpers = require('helpers');
const crypto = require('crypto');

const ConnString = "mongodb://localhost:27017/";
const client = new MongoClient(ConnString, { useUnifiedTopology: true, poolSize: 350 });

const PORT = process.env.PORT || 33333
const app = express()
app.use(cors());
app.use(bodyParser.json( { limit: '50mb'} ))
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }))
const headpath = 'Repo/';

const imageFilter = function(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
        req.fileValidationError = 'Only image files are allowed!';
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
exports.imageFilter = imageFilter;

app.post('/upload-new', (req, res) => {
    if (!fs.existsSync(headpath)) {
        fs.mkdirSync(headpath, { recursive: true })
    }

    let upload = multer({ storage: multer.diskStorage({
        destination: function(req, file, cb) {
            cb(null, headpath);
        },
        filename: function(req, file, cb) {
            cb(null,  path.parse(file.originalname).name + "_" + Date.now() + path.extname(file.originalname));
        }
    }), fileFilter: helpers.imageFilter }).array('images');

    upload(req, res, function(err) {
        if (req.fileValidationError) {
            return res.send(req.fileValidationError);
        }
        else if (!req.files) {
            return res.send('Please select an image to upload');
        }
        else if (err instanceof multer.MulterError) {
            return res.send(err);
        }
        else if (err) {
            return res.send(err);
        }

        var sortedfiles = [];
        for (var i = 0; i < req.files.length; i++) {
            //var newname = crypto.createHash('sha256').update(path.parse(req.body["ChapterIdx"] + "_" + req.files[i].filename).name).digest('hex');
            var newname = req.body["ChapterIdx"] + "_" + req.files[i].originalname;
            sortedfiles.push({ 
                filename: path.parse(req.files[i].originalname).name,
                filepath: newname
            });
            fs.renameSync(headpath + req.files[i].filename, headpath + newname);
        }

        sortedfiles.sort(function(a, b) {
            return a["filename"] - b["filename"];
        });
        client.db('Images').collection('Images').insertOne({ Chapter: req.body["ChapterIdx"], Entries: JSON.parse(JSON.stringify(sortedfiles)) });

        //console.log(JSON.stringify(sortedfiles));
        //console.log(req.body["ChapterIdx"]);

        res.send("OK");
    });
});

app.post('/upload-renew', async (req, res) => {
    if (!fs.existsSync(headpath)) {
        fs.mkdirSync(headpath, { recursive: true })
    }

    let upload = multer({ storage: multer.diskStorage({
        destination: function(req, file, cb) {
            cb(null, headpath);
        },
        filename: function(req, file, cb) {
            cb(null,  path.parse(file.originalname).name + "_" + Date.now() + path.extname(file.originalname));
        }
    }), fileFilter: helpers.imageFilter }).array('images');

    upload(req, res, async function(err) {
        if (req.fileValidationError) {
            return res.send(req.fileValidationError);
        }
        else if (!req.files) {
            return res.send('Please select an image to upload');
        }
        else if (err instanceof multer.MulterError) {
            return res.send(err);
        }
        else if (err) {
            return res.send(err);
        }

        if (!req.body["ChapterIdx"]){
            for (var i = 0; i < req.files.length; i++) {
                fs.rmSync(req.files[i].path);
            }
            return res.status(400).send("ERROR : UNABLE TO FIND THE ENTRIES");
        } else {
            var QueryRes = await client.db('Images').collection('Images').findOne({ Chapter: { $eq : req.body["ChapterIdx"] } }, {projection:{ _id: 0, Chapter: 0}})
            if (QueryRes == null){
                return res.status(400).send("ERROR : UNABLE TO FIND THE ENTRIES");
            }  
            
            QueryRes.Entries.forEach(e => {
                fs.rmSync(headpath + e["filepath"]);
            });
            
            var sortedfiles = [];
            for (var i = 0; i < req.files.length; i++) {
                var newname = req.body["ChapterIdx"] + "_" + req.files[i].originalname;
                sortedfiles.push({ 
                    filename: path.parse(req.files[i].originalname).name,
                    filepath: newname
                });
                fs.renameSync(headpath + req.files[i].filename, headpath + newname);
            }
    
            sortedfiles.sort(function(a, b) {
                return a["filename"] - b["filename"];
            });
            client.db('Images').collection('Images').updateOne({ Chapter: { $eq : req.body["ChapterIdx"] } }, { $set: { Entries: JSON.parse(JSON.stringify(sortedfiles)) } });
    
            res.send("OK");
        }
    });
});

app.post('/remove', async (req, res) => {
    if (!req.body.ChapterIdx) {
        return res.status(400).send("ERROR : UNABLE TO FIND THE ENTRIES");
    }

    var QueryRes = await client.db('Images').collection('Images').findOne({ Chapter: { $eq : req.body.ChapterIdx } }, {projection:{ _id: 0, Chapter: 0}})
    if (QueryRes == null){
        return res.status(400).send("ERROR : UNABLE TO FIND THE ENTRIES");
    }  
    
    QueryRes.Entries.forEach(e => {
        fs.rmSync(headpath + e["filepath"]);
    });
    
    client.db('Images').collection('Images').deleteOne({ Chapter: { $eq : req.body.ChapterIdx } });

    res.send("OK");

});

app.get('/image/:id', (req, res) => {
    if(!req.params.id){
        return res.status(400).send("ERROR : UNABLE TO FIND THE ENTRIES");
    }

    var filename = req.params.id;
     
    res.contentType('image/jpeg');
    res.sendFile( __dirname + "/" + headpath + filename);
})

app.get('/chapter/:id', async (req, res) => {
    if(!req.params.id){
        return res.status(400).send("ERROR : UNABLE TO FIND THE ENTRIES");
    }

    var QueryRes = await client.db('Images').collection('Images').findOne({ Chapter: { $eq : req.params.id } }, {projection:{ _id: 0, Chapter: 0}})
    if (QueryRes == null){
        return res.status(400).send("ERROR : UNABLE TO FIND THE ENTRIES");
    }     
    res.send(QueryRes.Entries);
})

app.get('/', function(req, res) {
    res.json({ message: 'WELCOME' });   
});

app.get('/upload',function(req,res){
    res.sendFile(__dirname + '/index.html');
   
  });

app.listen(PORT, async function () {
    await client.connect();
    console.log(`Server initialized on port ${PORT}`);
})

//fs.rmdirSync(dir, { recursive: true });