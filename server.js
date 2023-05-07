const express = require('express');
const path = require('path');
const app = express();
const Pool = require('pg').Pool;
const cors = require('cors');
const bodyParser = require('body-parser');
const { unescape } = require('unescape-js');
const PORT = process.env.PORT || 3001;

app.use(cors()); // it has to be there always
app.use(express.json()); // this too
app.use(bodyParser.json());

let db;

const { spawn } = require('child_process');

app.post("/api/sql", (req, res) => { // http://localhost:3001/connect, request, response

    const query = req.body.SQLfromUser;
    let results;
    console.log("query:", query);

    if (query) {

        // Spawn a new child process to execute the Python script
        const pythonProcess = spawn('python', ['python/sql_to_json.py', query]);

        let jsonString = '';
        let errorMessage = '';

        pythonProcess.on('error', (err) => {
            errorMessage = err.message;
        });
    
        // Listen for data on the stdout stream of the child process
        pythonProcess.stdout.on('data', (data) => {
            // Handle the JSON string output by the Python script
            jsonString += data.toString();
        });
    
        pythonProcess.stderr.on('data', (data) => {
            errorMessage = data.toString();
        });
    
        pythonProcess.on('close', () => {
            console.log("Python process closed.");
            
            try {
                if (errorMessage !== '') {
                    res.status(400).send(errorMessage);
                } else {
                    console.log('jsonString:', jsonString);
                    try {
                        results = JSON.parse(jsonString);
                    } catch (e) {                        
                        results = jsonString.replace( /[\r\n]+/gm, "" ).replace(/\"/g, '"');
                  
                    }
                    console.log('//////////////////');
                    console.log(results);
                    console.log('//////////////////');
                    res.json(results);
                }
            } catch (e) {
                // If parsing the JSON string failed, send the error message as the response to the frontend
                console.error(`Failed to parse JSON response from Python script: ${e}`);
                console.log(errorMessage);
                // console.log('//////////////////');
                res.status(400).send(errorMessage || '<Invalid SQL query>');
            }
        });
    
        // Send the SQL query to the Python script through stdin
        pythonProcess.stdin.write(`${query}\n`);
    }
  
});

app.post("/connect", async (req, res) => { // http://localhost:3001/connect, request, response
    // get info from frontend
    try {
        db = new Pool({
            host: req.body.host,
            user: req.body.user,
            password: req.body.password,
            database: req.body.database
        });
        await db.connect();

        const result = await new Promise((resolve, reject) => {
            db.query(
                `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';`,
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result.rows);
                    }
                }
            );
        });

        console.log("-> connected to database '%s'", req.body.database);
        res.send(result);
    } catch (error) {
        console.error("Failed to connect to database:", error.message);
        res.status(500).send("Failed to connect to database");
    }
});

const getDataFromTable = async (tableName) => {
    const res = await db.query(`SELECT * FROM ${tableName}`);
    return res.rows;
  };

app.get("/all_data", (req, res) => {
    const selectedOptions = JSON.parse(req.query.selectedOptions);
    console.log(selectedOptions);

    const allTableData = [];
    for (let i = 1; i < selectedOptions.length; i++) {
        const tableName = selectedOptions[i].value;

        getDataFromTable(tableName)
            .then(tableData => {

            //allTableData.push(tableData);     // without table names
            allTableData.push({[tableName]: tableData});      // with table names
            if (i == selectedOptions.length - 1) {
                res.setHeader('Content-Type', 'application/json');
                res.send(allTableData);
            }
        })
        .catch(error => {
            console.error(`Error retrieving data from ${tableName}:`, error);
        });
    }
});

app.listen(PORT, () => {
    console.log("Your server is running on port 3001");
});
