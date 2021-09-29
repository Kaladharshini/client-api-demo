$(function () {
    "use strict";

    window.chatwoot = {};
    // update the inbox identifier
    chatwoot.inboxIdentifier = "LfUdBT7BXwaghueSX2iAh6V2";
    chatwoot.chatwootAPIUrl = "https://weunlearn.hopto.org/public/api/v1/"

    // for better performance - to avoid searching in DOM
    var content = $('#content');
    var input = $('#input');
    var status = $('#status');
    var xhttp = new XMLHttpRequest();
    const hmac_key = "U7EucWM7Kqt4CgjQjRixYpRU";

    // if user is running mozilla then use it's built-in WebSocket
    window.WebSocket = window.WebSocket || window.MozWebSocket;

    // if browser doesn't support WebSocket, just show some notification and exit
    if (!window.WebSocket) {
        content.html($('<p>', { text: 'Sorry, but your browser doesn\'t '
                                    + 'support WebSockets.'} ));
        input.hide();
        $('span').hide();
        return;
    }

    // open connection
    var connection = new WebSocket('wss://weunlearn.hopto.org/cable');

    connection.onopen = function () {
        // check whether we have a pubsub token and contact identifier or else set one
        setUpContact();
        setUpConversation();
 
        // first we want users to subscribe to the chatwoot webhooks
        connection.send(JSON.stringify({command:"subscribe", identifier: "{\"channel\":\"RoomChannel\",\"pubsub_token\":\""+chatwoot.contactPubsubToken+"\"}" }));
        input.removeAttr('disabled');
        status.text('Send Message:');
    };

    connection.onerror = function (error) {
        // just in there were some problems with connection...
        content.html($('<p>', { text: 'Sorry, but there\'s some problem with your '
                                    + 'connection or the server is down.' } ));
    };

    // most important part - incoming messages
    connection.onmessage = function (message) {
        // try to parse JSON message. Because we know that the server always returns
        // JSON this should work without any problem but we should make sure that
        // the massage is not chunked or otherwise damaged.
        try {
            var json = JSON.parse(message.data);
        } catch (e) {
            console.log('This doesn\'t look like a valid JSON: ', message.data);
            return;
        }
 
        if (json.type === 'welcome') { 
          // lets ignore the welcome
        } else if (json.type === 'ping') {
          // lets ignore the pings
        } else if (json.type === 'confirm_subscription') {
          // lets ignore the confirmation
        }else if (json.message.event === 'message.created') {
          console.log('here comes message', json);
          if(json.message.data.message_type === 1)
          { 
            addMessage(json.message.data.sender.name, json.message.data.content); 
          }
        } else {
          console.log('Hmm..., I\'ve never seen JSON like this: ', json);
        }
    };

    /**
     * Send mesage when user presses Enter key
     */
    input.keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = $(this).val();
            if (!msg) {
                return;
            }
            // send the message to chatwoot
            //connection.send(msg);
            sendMessage(msg);
            addMessage("me", msg)
            $(this).val('');
        }
    });

    /**
     * This method is optional. If the server wasn't able to respond to the
     * in 3 seconds then show some error message to notify the user that
     * something is wrong.
     */
    setInterval(function() {
        if (connection.readyState !== 1) {
            status.text('Error');
            input.attr('disabled', 'disabled').val('Unable to communicate '
                                                 + 'with the WebSocket server.');
        }
    }, 3000);

    /**
     * Add message to the chat window
     */
    function addMessage(author, message) {
        content.append('<p><span>' + author + '</span> @ ' + ':' +  message + '</p>');
        content.scrollTop(1000000);
    }

    function setUpContact() {
        console.log("In setUpContact: ");

        var digits = Math.floor(Math.random() * 9000000000) + 1000000000;
        let phone_number = "+91"+digits;

        if(localStorage.getItem("contactIdentifier")==undefined) {
            localStorage.clear();
        }
      if(localStorage.getItem('contactIdentifier')) {
        chatwoot.contactIdentifier = localStorage.getItem('contactIdentifier');
        chatwoot.contactPubsubToken = localStorage.getItem('contactPubsubToken');
        console.log("Contact details: ",chatwoot.contactIdentifier, chatwoot.contactPubsubToken);
      }
      else {
          console.log("Calling createContact in setUpContact!");
          createContact(phone_number);
      }
    }


    function createContact(phone_number) {
        console.log(phone_number);
        let phone = phone_number.substring(3, phone_number.length);
        console.log(phone);
        var hash = CryptoJS.HmacSHA256(phone, hmac_key);
        var hashInHex = CryptoJS.enc.Hex.stringify(hash);
        var contactPubsubToken;
        var contactIdentifier;
        var data = JSON.stringify({
            "identifier": phone,
            "identifier_hash": hashInHex,
            "name": phone,
            "phone_number": phone_number
        });

        var xhr = new XMLHttpRequest();

        xhr.addEventListener("readystatechange", function() {
            if(this.readyState === 4) {
                console.log("In createContact: ",this.responseText);
                try {
                    let res = JSON.parse(this.responseText);
                    contactIdentifier = res.source_id;
                    contactPubsubToken = res.pubsub_token;
                    localStorage.setItem("contactIdentifier", contactIdentifier);
                    localStorage.setItem("contactPubsubToken", contactPubsubToken);
                } catch(e) {
                    console.log(e);
                }
            }
        });

        xhr.open("POST", "https://weunlearn.hopto.org/public/api/v1/inboxes/LfUdBT7BXwaghueSX2iAh6V2/contacts", false);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(data);
    }

    function setUpConversation() {
        console.log("In setUpConversation: ");
      if(localStorage.getItem('contactConverstion')){
        chatwoot.contactConverstion = localStorage.getItem('contactConverstion');
        console.log("Conversation id: ",chatwoot.contactConverstion);
        getMessages();
      }
      else {
          console.log("Calling createConversation in setUpConversation!");
          while(chatwoot.contactIdentifier==undefined) {
              chatwoot.contactIdentifier = localStorage.getItem('contactIdentifier');
          }
          createConversation();
      }
    }

    function getMessages() {
        var data = JSON.stringify({
            "conversation_id": chatwoot.contactConverstion
        });

        var xhr = new XMLHttpRequest();

        xhr.addEventListener("readystatechange", function() {
            if(this.readyState === 4) {
                console.log(this.responseText);
                try {
                    let res_arr = JSON.parse(this.responseText);
                    const n = res_arr.length;
                    var i;
                    for(i=0; i<n; i++) {
                        if(res_arr[i].message_type==1) {
                            addMessage("WeUnlearn", res_arr[i].content);
                        } else if(res_arr[i].message_type==0) {
                            addMessage("Me", res_arr[i].content);
                        }
                    }

                } catch(e) {

                }
            }
        });

        xhr.open("GET", chatwoot.chatwootAPIUrl+"inboxes/"+chatwoot.inboxIdentifier+"/contacts/"+chatwoot.contactIdentifier+"/conversations/"+chatwoot.contactConverstion+"/messages", false);
        xhr.setRequestHeader("Content-Type", "application/json");

        xhr.send(data);
    }

    function createConversation() {
        var contactConversation;
        var data = "";
        var xhr = new XMLHttpRequest();

        xhr.addEventListener("readystatechange", function() {
            if(this.readyState === 4) {
                console.log(this.responseText);
                try {
                    console.log("In createConversation: ",this.responseText);
                    let res = JSON.parse(this.responseText);
                    contactConversation = res.id;
                    chatwoot.contactConverstion = res.id;
                    console.log("convo id: ",contactConversation);
                    localStorage.setItem("contactConverstion",contactConversation);
                } catch (e) {
                    console.log(e);
                }
            }
        });


        xhr.open("POST", chatwoot.chatwootAPIUrl+"inboxes/"+chatwoot.inboxIdentifier+"/contacts/"+chatwoot.contactIdentifier+"/conversations", false);
        xhr.send(data);
    }

    function sendMessage(msg){

        if(chatwoot.contactConverstion==undefined) {
            localStorage.removeItem("contactConverstion");
            chatwoot.contactIdentifier = localStorage.getItem("contactIdentifier");
            setUpConversation();
        }

        var data = JSON.stringify({
            "content": msg
        });

        var xhr = new XMLHttpRequest();
        xhr.addEventListener("readystatechange", function() {
            if(this.readyState === 4) {
                console.log("In sendMessage: ",this.responseText);
            }
        });

        xhr.open("POST", chatwoot.chatwootAPIUrl+"inboxes/"+chatwoot.inboxIdentifier+"/contacts/"+chatwoot.contactIdentifier+"/conversations/"+chatwoot.contactConverstion+"/messages", false);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(data);
    }

});