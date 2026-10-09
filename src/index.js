const express = require('express');
const cors = require('cors');
require('dotenv').config();

const productRoutes = require('./routes/productRoutes');
const loteRoutes = require('./routes/loteRoutes'); 

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', productRoutes);
app.use('/api', loteRoutes); 

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});