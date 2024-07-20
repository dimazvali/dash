
let ngrok = process.env.ngrok;

if(process.env.develop) ngrok = process.env.ngrok2;

const host = `dash`;

const token = process.env.dashToken;

var express =   require('express');
var router =    express.Router();
var axios =     require('axios');

const fileUpload = require('express-fileupload');
const { createHash,createHmac } = require('node:crypto');

router.use(fileUpload({
    // Configure file uploads with maximum file size 10MB
    limits: { fileSize: 10 * 1024 * 1024 },
  
    // Temporarily store uploaded files to disk, rather than buffering in memory
    useTempFiles : true,
    tempFileDir : '/tmp/'
  }));

const {
    devlog,
    handleQuery,
    handleDoc,
    handleError,
} = require('./common.js')


const {
    sendMessage2,
    getUser,
    greeting
} = require('./methods.js');


const {
    initializeApp,
    applicationDefault,
    cert
} = require('firebase-admin/app');

const {
    getFirestore,
    Timestamp,
    FieldValue
} = require('firebase-admin/firestore');


let gcp = initializeApp({
    credential: cert({
        "type":             "service_account",
        "project_id":       "dimazvalimisc",
        "private_key_id":   "5eb5025afc0fe53b63f518ba071f89e7b7ce03af",
        "private_key":      process.env.gcpKey.replace(/\\n/g, '\n'),
        "client_email":     "firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com",
        "client_id":        "110523994931477712119",
        "auth_uri":         "https://accounts.google.com/o/oauth2/auth",
        "token_uri":        "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com"
      }),
    databaseURL: "https://dimazvalimisc-default-rtdb.europe-west1.firebasedatabase.app"
}, host);

let fb =    getFirestore(gcp);

let udb =                   fb.collection(`${host}Users`);
let messages =              fb.collection(`${host}UsersMessages`);
let logs =                  fb.collection(`${host}Logs`);

setTimeout(function () {
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/${host}/hook`).then(() => {
        console.log(`${host} hook set on ${ngrok}`)
    }).catch(err => {
        handleError(err)
    })
}, 1000)

function log(o) {

    o.createdAt = new Date()

    logs.add(o).then(r => {

        if (!o.silent) {
            alertAdmins({
                text: o.text
            })
        }
    })
}


async function registerUser(u) {

    u.createdAt = new Date();
    u.active = true;
    u.blocked = false;
    u.score = 0;
    
    if(u.language_code) u[u.language_code] = true;

    udb.doc(u.id.toString()).set(u).then(() => {

        // TBD приветствие

        sendMessage2({
            chat_id:u.id,
            text: `Hello, world!` 
        },false,token,messages)

        log({
            user: +u.id,
            text: `new user: ${uname(u,u.id)}`
        })

        return true
    })

}

function uname(u,id){
    if(!u) u = {};
    return `${u.admin? `admin` : (u.insider ? 'associate' : (u.fellow ? 'fellow' : 'user'))} ${u.username ? `@${u.username}` : `id ${id}` } (${u.first_name||''} ${u.last_name||''})`
}


function alertAdmins(mess) {
    let message = {
        text: mess.text,
        isReply: true
    }

    if(mess.reply_markup) message.reply_markup = mess.reply_markup

    udb.where(`admin`, '==', true).get().then(admins => {
        admins = handleQuery(admins)
        // if(process.env.develop) admins = admins.filter(a=>+a.id == dimazvali)
        admins.forEach(a => {
            message.chat_id = a.id
            if (mess.type != 'stopLog' || !a.stopLog) sendMessage2(message, false, token, messages)
        })
    })
}



router.post(`/authRoom`,(req,res)=>{

    data_check_string=Object.keys(req.body)
        .filter(key => key !== 'hash')
        .sort()
        .map(key=>`${key}=${req.body[key]}`)
        .join('\n')

    const secretKey = createHmac('sha256','WebAppData')
        .update(token)
        .digest();

    const hmac = createHmac('sha256', secretKey)
        .update(data_check_string)
        .digest('hex');

    if(req.body.hash == hmac){

        req.body.user = JSON.parse(req.body.user);
        
        getUser(req.body.user.id,udb).then(async u=>{
        
            if(u && u.blocked) return res.sendStatus(403)

            if(!u) {
                u = req.body.user;
                await registerUser(req.body.user)
            }

            devlog(u);

            udb.doc(req.body.user.id.toString()).update({
                entries:    FieldValue.increment(+1),
                recent:     new Date()
            })
            res.json({
                room:   req.query.room,
                name:   encodeURIComponent(unamDash(u)),
                photo:  u.photo_url || 'https://i.imgur.com/Wd022EM.jpeg'
            })
              
        }).catch(err=>{
            res.status(400).send(err.message)
            console.log(err)
        })
    } else {
        res.sendStatus(403)
    }
})

function unamDash(u){
    if(u.first_name || u.last_name) return (u.first_name+' '+u.last_name).trim();
    if(u.username) return u.username
    return u.id
}

router.get(`/app`,(req,res)=>{
    console.log(req.query)
    res.render(`${host}/app`,{
        room: req.query.tgWebAppStartParam
    })
    // res.redirect(`https://dishdash.f-dyakonov.ru?room=${req.query.tgWebAppStartParam}&name=some user&photo=https://i.imgur.com/Wd022EM.jpeg`)
})

router.post(`/hook`, (req, res) => {
    res.sendStatus(200)

    devlog(JSON.stringify(req.body, null, 2))

    let user = {};

    if (req.body.my_chat_member) {
        if (req.body.my_chat_member.new_chat_member.status == 'kicked') {

            udb.doc(req.body.my_chat_member.chat.id.toString()).update({
                active: false,
                stopped: true
            }).then(s => {
                udb.doc(req.body.my_chat_member.chat.id.toString()).get().then(u => {

                    u = handleDoc(u)

                    log({
                        silent: true,
                        text: `${uname(u,u.id)} blocks the bot`,
                        user: +u.id
                    })
                })

            }).catch(err => {
                console.log(err)
            })
        }
    }
    if (req.body.message && req.body.message.from) {
        user = req.body.message.from;

        getUser(user.id, udb).then(u => {
            
            if (!u) return registerUser(user)

                
            if (!u.active) return udb.doc(user.id.toString()).update({
                active: true,
                stopped: null
            }).then(s => {
                log({
                    silent: true,
                    user: +user.id,
                    text: `user id ${user.id} comes back`
                })
            })

            if (req.body.message.photo && !req.body.message.chat.is_forum) {
                udb.where('admin','==',true).get().then(col=>{
                    handleQuery(col).forEach(a=>{
                            sendMessage2({
                                chat_id:    a.id,
                                caption:    `pics from ${uname(u,u.id)}`,
                                photo:      req.body.message.photo[0].file_id
                        }, 'sendPhoto', token, messages)
                    })
                })
            }

            if (req.body.message.text) {
                if(!req.body.message.chat.is_forum) messages.add({
                    user: user.id,
                    text: req.body.message.text || null,
                    createdAt: new Date(),
                    isReply: false
                })
            }

            if (req.body.message.text && !req.body.message.chat.is_forum) {
                
                
                if (req.body.message.text == `/start`) {
                    return sendMessage2({
                        chat_id:    user.id,
                        parse_mode: `Markdown`,
                        text:       `Hello, world!`,
                    }, false, token, messages)
                } else {
                    return alertAdmins({
                        text: `${uname(u,u.id)} says: ${req.body.message.text}`,
                        user: user.id
                    })
                }
            }
        })
    }

    if(req.body.inline_query){
        let q = req.body.inline_query
        if(!q.location){
            // вежливый отказ
            sendMessage2({
                inline_query_id:q.id,
                results: [{
                    type:       `article`,
                    id:         `noLocation`,
                    title:      `Phones only`,
                    input_message_content: {
                        message_text: `Эта штука будет работать только с телефона. Увых.`
                    }
                }]
            },`answerInlineQuery`,token)
        } else {
            let coords = q.location
            axios.get(`https://dishdash.f-dyakonov.ru/generateRoomID?longitude=${coords.longitude}&latitude=${coords.latitude}`)
                .then(data=>{
                    sendMessage2({
                        inline_query_id:q.id,
                        results: [{
                            type:       `photo`,
                            id:         `app2`,
                            photo_url:  `${ngrok}/images/dash/cover.jpg`,
                            title:      data.data.room_id,
                            description: `Приглашение в комнату ${data.data.room_id}`,
                            is_personal: false,
                            caption:    `Не знаете, куда пойти? Давайте найдем, с кем! (инвайт в комнату ${data.data.room_id})`,
                            thumbnail_url: `${ngrok}/dash/cover.jpg`,
                            reply_markup: {
                                inline_keyboard:[[{
                                    text: 'Some app',
                                    url: `https://t.me/dish_dash_bot/app?startapp=${data.data.room_id}`
                                }]]
                            }
                        }]
                    },`answerInlineQuery`,token)
                })
                .catch(err=>{
                    
                    console.log(err);

                    alertAdmins({
                        text: err.message
                    })
                    sendMessage2({
                        inline_query_id:q.id,
                        results: [{
                            type:       `article`,
                            id:         `noLocation`,
                            title:      `ooops! у нас ошибочка`,
                            input_message_content: {
                                message_text: err.message
                            }
                        }]
                    },`answerInlineQuery`,token)
                })
        }
    }
})

module.exports = router;
