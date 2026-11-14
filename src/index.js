const express = require('express');
const cors = require('cors');
require('dotenv').config();

const productRoutes = require('./routes/productRoutes');
const loteRoutes = require('./routes/loteRoutes'); 
const authRoutes = require('./routes/authRoutes');
const reservaRoutes = require('./routes/reservaRoutes');
const ventaRoutes = require('./routes/ventaRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', productRoutes);
app.use('/api', loteRoutes); 
app.use('/api', reservaRoutes);
app.use('/api', ventaRoutes);
app.use('/api/auth', authRoutes); 

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        servicio: 'Leveling Jump API',
        mensaje: 'Servidor operativo y listo para recibir peticiones.'
    });
}); 

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});