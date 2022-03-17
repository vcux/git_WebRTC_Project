//this is all regular setup for the server we're gonna use on port 8080
//#region setup
const express = require('express')
const app = express()
const httpolyglot = require('httpolyglot')
const path = require('path')
const options = require('localhost.daplie.me-certificates').merge({});

const port = process.env.PORT || 8080

const env = process.env.NODE_ENV || 'development';

// Redirect to https
app.get('*', (req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && env !== 'development') {
        return res.redirect(['https://', req.get('Host'), req.url].join(''));
    }
    next();
});

app.use(express.static(path.join(__dirname, '..','public')))
app.use(express.static(path.join(__dirname, '..','node_modules')))



const httpsServer = httpolyglot.createServer(options, app)
const io = require('socket.io')(httpsServer)

httpsServer.listen(port, () => {
    console.log(`listening on port ${port}`)
})
//#endregion

peers = {}

/**
 * Socket.io events
 */
io.sockets.on('connect', function (socket) {
    console.log('a client is connected')
    peers[socket.id] = socket
    socket.emit('once', socket.id);


    //is called when the connect button is pressed and the room id isn't empty it sends the client's feed to all others in the room and determins if the client is the host or not
    socket.on('roomConnect', data => {
        var counter = 0;
        peers[socket.id].room = data.room_id;
        for(let id in peers) {
            console.log(id.room);
            if(id === socket.id || peers[id].room != data.room_id){ 
                if(id === socket.id) peers[id].emit('room_id', {room_id: data.room_id, socket_id: id});
                continue;
            }
            counter++;
            console.log('sending init receive to ' + socket.id)
            peers[id].emit('initReceive', socket.id)
        }
        if(counter == 0) socket.emit('hostStart', socket.id)
    })

    socket.on('signal', data => {
        console.log('sending signal from ' + socket.id + ' to ', data)
        if(!peers[data.socket_id])return
        peers[data.socket_id].emit('signal', {
            socket_id: socket.id,
            signal: data.signal
        })
    })

    //this is called when the disconnect button is pressed, it resets the clients room and removes his feed from all other clients
    socket.on('roomDisconnect', () => {
        console.log('socket roomDisconnected ' + socket.id)
        peers[socket.id].room = undefined;
        socket.broadcast.emit('removePeer', socket.id)
    })

    //this is called by the server when a client disconnects like the connect here we make sure the the clients feed was removed from all client's screens and remove the disconnected client from our peers
    socket.on('disconnect', () => {
        console.log('socket disconnected ' + socket.id)
        socket.broadcast.emit('removePeer', socket.id)
        delete peers[socket.id]
    })
    
    //this is called by a client that received a video from a new client and is sending back his own local video
    socket.on('initSend', init_socket_id => {
        console.log('INIT SEND by ' + socket.id + ' for ' + init_socket_id)
        peers[init_socket_id].emit('initSend', socket.id)
    })
    
    //this is called by a client that sent a message and it sends the message to all rooms and later only to the room of the sender
    socket.on('message', data=>{
        if(peers[socket.id].room != undefined){io.emit('chat', {message: socket.id +": "+ data.message, room_id: data.room_id})}
    })

    //is called by the host and calls for function which will kick the requested client
    socket.on('kick', socket_id => {console.log('kicking you out'); peers[socket_id].emit('kicked', socket_id)})
})
