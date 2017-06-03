// TODO move to import/export once native Node.js supports it

const queue = require('bull');
const VK = require('vk-io');

let messages;

class VKBotBase {

    constructor (config, log) {
        this.config = config;
        this.log = log;
        messages = queue(`${this.config.appName}:${this.config.messagesQueue}`, this.config.redis);
        this.messages = messages;
    }

    selectTokenFor (type, number) {
        if (!this.config[type] || !this.config[type].tokens || !this.config[type].call ||
            !(this.config[type].tokens instanceof Array)) {
            this.log.crash(`Invalid ${type} data. Should be \n"type": {\n\ttokens: ["token1", "token2"],\n\tcall: "<execute/api>"\n}`);
        } else if (number >= this.config[type].tokens.length || number < 0) {
            this.log.crash(`Invalid ${type} token number`);
        } else {
            this[type] = new VK({
                token: this.config[type].tokens[number],
                call: this.config[type].call,
            });

            this[type].api.groups.isMember({
                group_id: 1,
                user_id: 1,
            })
            .then(() => {
                this.log.info(`${type} token #${number}: ${this.config[type].tokens[number]}, is valid`);
            })
            .catch((error) => {
                this.log.error(`${type} token #${number}: ${this.config[type].tokens[number]}, is not valid`);
                this.log.crash(error);
            });
        }
    }

    validateCommunity () {
        if (!this.community) {
            this.log.crash('.setCommunity() requires community token to be set');
        } else if (!this.config.community.id || this.config.community.id <= 0) {
            this.log.crash(`Invalid community id ${this.config.community.id}`);
        } else {
            this.community.api.groups.getCallbackServerSettings({
                group_id: this.config.community.id,
            })
            .then(() => {
                this.log.info(`Access to community id ${this.config.community.id} is granted`);
            })
            .catch((error) => {
                this.log.info(`Access to community id ${this.config.community.id} is denied`);
                this.log.crash(error);
            });
        }
    }

    setActiveInstance (name) {
        if (!this[name]) {
            this.log.crash(`${name} instance is not created`);
        }
        this.active = this[name];
    }

    longpollStart (events) {
        if (!this.community) {
            this.log.crash('.longpollStart() requires community token to be set');
        } else if (this.longpoll) {
            this.log.warn('Long poll already started');
            return;
        }

        this.longpoll = this.community.longpoll;
        this.longpoll.start()
        .then(() => {
            events.forEach((event) => {
                this.longpollAddEvent(event);
            });
            this.log.info('Long poll started successfully');
        })
        .catch((error) => {
            this.log.error('Long poll was unable to start');
            this.log.crash(error);
        });
    }

    longpollAddEvent (event) {
        this.longpoll.on(event.name, event.action);
        this.log.info(`Added event "${event.name}" to long poll`);
    }

    longpollRemoveEvent (event) {
        this.longpoll.removeListener(event.name, event.action);
        this.log.info(`Removed event "${event.name}" from long poll`);
    }

    longpollPreprocessMessage (message) {
        if (!(message.flags.indexOf('answered') !== -1 || message.flags.indexOf('outbox') !== -1)) {
            message.vk = undefined;
            messages.add(message, {
                removeOnComplete: true,
                removeOnFail: true,
            });
        }
    }

    isMember (userId) {
        return new Promise((resolve, reject) => {
            this.log.info(userId, 'Checking if user follows community');
            this.active.api.groups.isMember({
                group_id: this.config.community.id,
                user_id: userId,
            })
            .then((isMember) => {
                if (isMember) {
                    this.log.info(userId, 'Is a community member');
                    resolve();
                } else {
                    this.log.info(userId, 'Not a community member');
                    reject({ reason: 'notMember' });
                }
            })
            .catch(reject);
        });
    }

    sendMessage (message, msgName = '') {
        return new Promise((resolve, reject) => {
            this.active.api.messages.send(message)
            .then(() => {
                this.log.info(message.peer_id, msgName, 'message has been sent');
                resolve();
            })
            .catch((error) => {
                this.log.info(message.peer_id, msgName, 'message has not been sent', error);
                reject({ reason: 'unableToSend' });
            });
        });
    }
}

module.exports = VKBotBase;
