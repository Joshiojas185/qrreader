const express = require("express");
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 4300

// const HOST = '192.168.29.153';

app.listen(PORT , () => {
    console.log(`Server running on port : ${PORT}`);
})