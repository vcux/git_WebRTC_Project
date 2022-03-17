//#region configuration
let socket;
let localStream = null;
/**
* lists all the simple peer peers 
*/
let peers = {};
let rooms = {};

var host = false;

//#region html elements
const chatWindow_element = document.querySelector('.chatWindow');
const room_id_element = document.querySelector("#room_id");
const input_box_element = document.querySelector('#inputBox');
const disconnect_element = document.querySelector("#disconnect");
const connect_element = document.querySelector("#connect");
const socket_id_element = document.querySelector("#socket_id");

//enables sending message with the enter key
input_box_element.addEventListener("keyup", function(event) {
    // Number 13 is the enter key on the keyboard
    if (event.keyCode === 13) {
        sendChat();
    }
});
  
//#endregion

  
/**
 * servers for hosting the programs currently using google test iceServers
 */
 const configuration = 
{
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302',
            ],
        },
        {
            // public turn server from https://gist.github.com/sagivo/3a4b2f2c7ac6e1b5267c2f1f59ac6c6b
            urls: 'turn:192.158.29.39:3478?transport=udp',
            credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
            username: '28224511:1379330808',
        },
    ],
}
/**
  * with the constrains you can force the input to conform to your needs audio true so we can hear aswell
  */
let constraints = {
    audio: true,
    video: {
        width: {
             max: 300
        },
        height: {
            max: 300
        },
        facingMode:{ideal: "user"}
    }
}
 
 
//get the user video with the constrains and show it
navigator.mediaDevices.getUserMedia(constraints).then(stream => {
    console.log('Received local stream');
 
    localVideo.srcObject = stream;
    localStream = stream;
 
    init()
 
}).catch(e => alert('etUserMedia Error' + e.name))
//#endregion

//#region connection handling

/**
* in init we set up all the 'event handlers' 
*/
function init() {
    socket = io()

    //this is called once when the client first connects we do this to store his id for future use
    socket.on('once', socket_id => {
        socket_id_element.value = socket_id ;
    })

    //this is called when a client opens a new room
    socket.on('hostStart', socket_id => {
        console.log('host has opened a new room')
        host = true;
    })

    //this is called each time the client sends a message
    socket.on('chat', data=>{
        if(data.room_id == rooms[socket_id_element.value]){
            renderMessage(data.message);
            console.log('Received : ', data.message);
        }
    })

    //init Received is called to every peer when a new peer joins the room to add the new peer's local video to every peer's screen 
    socket.on('initReceive', socket_id => {
         console.log('INIT RECEIVE ' + socket_id)
         addPeer(socket_id, false)
 
         socket.emit('initSend', socket_id)
    })

    //this is called when joining a new room and is for initializing the clients room
    socket.on('room_id', data => {
        rooms[data.socket_id] = data.room_id;
    })
 
    //after init receive every peer that added the new peer's local video sends back to the new peer their own local video so that he will add them to his screen
    socket.on('initSend', socket_id => {
         console.log('INIT SEND ' + socket_id)
         addPeer(socket_id, true)
    })

    //this is called for each peer when a peer leaves the room and it removes the deleted peer's video from each peers screen
    socket.on('removePeer', socket_id => {
         console.log('removing peer ' + socket_id)
         removePeer(socket_id)
    })
 
    //removes all peers from the disconnected peer's data
    socket.on('disconnect', () => {
         console.log('GOT DISCONNECTED')
         for (let socket_id in peers) {
             removePeer(socket_id)
         }
    })
 
    socket.on('signal', data => {
        peers[data.socket_id].signal(data.signal)
    })


    //is called when the host kicks the client
    socket.on('kicked', () => {roomDisconnect()
    });

}

/**
 * is called when the connect button is pressed it registers  the client to a room
 */
 function roomConnect(){
    if(room_id_element.value == '')
        return;
    connect_element.disabled = true;
    disconnect_element.disabled = false;
    if(room_id_element.value != undefined)
        socket.emit("roomConnect", {room_id: room_id_element.value});
}

/**
 * is called when the disconnect button is pressed it removes all other peer's videos and remove client from a room
 */
function roomDisconnect(){
    host = false;
    chatWindow_element.innerHTML = '';
    connect_element.disabled = false;
    disconnect_element.disabled = true;
    for (let socket_id in peers) {
        removePeer(socket_id)
    }
    rooms[socket_id_element.value] = undefined;
    socket.emit("roomDisconnect");
}

/**
* removes the deleted peer's video from the client's screen
* @param {socket id of the peer to remove} socket_id 
*/
function removePeer(socket_id) {
 
     let videoEl = document.getElementById(socket_id)
     if (videoEl) {
 
         //const tracks = videoEl.srcObject.getTracks();
 
         //tracks.forEach(function (track) {
         //    track.stop()
        // })
 
         videoEl.srcObject = null
         videoEl.parentNode.removeChild(videoEl)
     }
     if (peers[socket_id]) peers[socket_id].destroy()
     delete peers[socket_id]
}
 
/**
* adds a client to peers and sets up the client's 'event handlers'
* @param {new peer's socket id} socket_id 
* @param {} am_initiator 
*/
function addPeer(socket_id, am_initiator) {
    peers[socket_id] = new SimplePeer({
        initiator: am_initiator,
        stream: localStream,
        config: configuration
    })
    rooms[socket_id] = room_id_element.value;

    //if(peer[socket_id_element.value] === peers[socket_id]) {console.log('isequale')}

    peers[socket_id].on('signal', data => {
        socket.emit('signal', {
            signal: data,
            socket_id: socket_id
        })
    })
 
    peers[socket_id].on('stream', stream => {
        let div = document.createElement('div')
        div.className = 'videoContainer'
        let newVid = document.createElement('video')
        newVid.srcObject = stream
        div.id = socket_id
        newVid.playsinline = false
        newVid.autoplay = true
        newVid.className = "vid"
        newVid.onclick = () => openPictureMode(newVid)
        newVid.ontouchstart = (e) => openPictureMode(newVid)
        if(host){
            let kick = document.createElement("button")
            kick.innerHTML= 'kick';
            kick.className = 'kick'
            kick.onclick = function(){console.log('working'); socket.emit('kick', socket_id)}
            let kickp = document.createElement('div')
            kickp.className = 'kickp'
            kickp.appendChild(kick)
            
            div.appendChild(kickp)
            div.appendChild(newVid)
            videos.appendChild(div)
            return
        }
        
        div.appendChild(newVid)
        videos.appendChild(div)
    })

    /*if (permissions[socket_id] == true) {
        const kickBtn = document.createElement('button');
        kickBtn.setAttribute('class', 'kick_btn');
        kickBtn.textContent = 'Kick';

        kickBtn.addEventListener('click', () => {
            kickUser(socketId);
        });

        videoContainer.append(kickBtn);
    }*/
}
//#endregion

//#region options
/**
* move video to picture mode only usable on other peers
* @param {*} el 
*/
function openPictureMode(el) {
    console.log('opening pip')
    el.requestPictureInPicture()
}
/**
 * this is called when the switch camera button is pressed it switches between the user facing and the other camera in a phone
 */
function switchMedia() {
    if (constraints.video.facingMode.ideal === 'user') {
        constraints.video.facingMode.ideal = 'environment'
    } else {
        constraints.video.facingMode.ideal = 'user'
    }
 
    const tracks = localStream.getTracks();
 
    tracks.forEach(function (track) {
        track.stop()
    })
 
    localVideo.srcObject = null
    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
 
        for (let socket_id in peers) {
            for (let index in peers[socket_id].streams[0].getTracks()) {
                for (let index2 in stream.getTracks()) {
                    if (peers[socket_id].streams[0].getTracks()[index].kind === stream.getTracks()[index2].kind) {
                        peers[socket_id].replaceTrack(peers[socket_id].streams[0].getTracks()[index], stream.getTracks()[index2], peers[socket_id].streams[0])
                        break;
                    }
                }
            }
        }
 
        localStream = stream
        localVideo.srcObject = stream
    })
}
/**
 * this is called when the screen share button is pressed it allows the user to share their screen instead of their camera
 */
function setScreen() {

    navigator.mediaDevices.getDisplayMedia().then(stream => {
        const screenTrack = stream.getTracks()[0];

        localStream = stream
        localVideo.srcObject = localStream

        for (let socket_id in peers) {
            for (let index in peers[socket_id].streams[0].getTracks()) {
                for (let index2 in stream.getTracks()) {
                    if (peers[socket_id].streams[0].getTracks()[index].kind === stream.getTracks()[index2].kind) {
                        peers[socket_id].replaceTrack(peers[socket_id].streams[0].getTracks()[index], stream.getTracks()[index2], peers[socket_id].streams[0])
                        break;
                    }
                }
            }

        }
        
        screenTrack.onended = function () {

            navigator.mediaDevices.getUserMedia(constraints).then(stream => {
                for (let socket_id in peers) {
                    for (let index in peers[socket_id].streams[0].getTracks()) {
                        for (let index2 in stream.getTracks()) {
                            if (peers[socket_id].streams[0].getTracks()[index].kind === stream.getTracks()[index2].kind) {
                                peers[socket_id].replaceTrack(peers[socket_id].streams[0].getTracks()[index], stream.getTracks()[index2], peers[socket_id].streams[0])
                                break;
                            }
                        }
                    }

                }
                localStream = stream
                localVideo.srcObject = localStream
            }).catch(function (error) {
                console.log(error);
            });

        }

    })

}
 /**
  * is called when the mute button is pressed it mutes the client
  */
function toggleMute() {
    for (let index in localStream.getAudioTracks()) {
        localStream.getAudioTracks()[index].enabled = !localStream.getAudioTracks()[index].enabled
        muteButton.innerText = localStream.getAudioTracks()[index].enabled ? "Unmuted" : "Muted"
    }
}
/**
 * is called when the video enabled button is pressed it turns the peer's view of the client camera to black and back
 */
function toggleVid() {
    for (let index in localStream.getVideoTracks()) {
        localStream.getVideoTracks()[index].enabled = !localStream.getVideoTracks()[index].enabled
        vidButton.innerText = localStream.getVideoTracks()[index].enabled ? "Video Enabled" : "Video Disabled"
    }
}
//#endregion

//#region chat

/**
 * is called each time the client receives a message and outs it on top of the chat box
 * @param {new message that will appear on top of the chat} message 
 */
const renderMessage = message => {
   const div = document.createElement('div')
   div.classList.add('render-message')
   div.innerText = message
   var temp = chatWindow_element.innerHTML;
   chatWindow_element.innerHTML = '';
   chatWindow_element.appendChild(div)
   chatWindow_element.innerHTML += temp;
}
/**
 * is called when the send chat button is pressed it sends the writen message to all peers in the same room
 */
function sendChat() {
 
    console.log("sent message!");
 
    let msg2send = document.getElementById('inputBox').value;
    document.getElementById('inputBox').value = '';

    if(rooms[socket_id_element.value] != undefined)
        socket.emit("message", {message: msg2send,  room_id: rooms[socket_id_element.value]});
}
//#endregion