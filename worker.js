const config = require(`./${process.argv[2]}`);

const Logger = require('./components/logger');
const BotBase = require('./components/botbase');
const redis = require('then-redis').createClient;
const request = require('request-promise');
const fs = require('fs');

const log = new Logger('Worker');
const Community = new BotBase(config, log);
const Service = new BotBase(config, log);
const redisClient = redis(config.redis);

Community.selectTokenFor('community', process.env.token_id ? process.env.token_id : 0);
Community.validateCommunity();
Community.setActiveInstance('community');

Service.selectTokenFor('service', process.env.token_id ? process.env.token_id : 0);
Service.setActiveInstance('service');

const DownloadImage = (url, userId) => {
    log.info(userId, 'Request for image download', url);
    return new Promise((resolve, reject) => {
        request.head({
            url,
            headers: {
                'User-Agent': config.appName,
            },
            timeout: 60000,
        })
        .then((headerRes) => {
            if (headerRes['content-type'].indexOf('image') === -1) {
                Community.sendMessage({
                    peer_id: userId,
                    message: config.responseMessages.error,
                }, 'wrongContentType').catch(() => {});
                return reject({ reason: 'wrongContentType' });
            }

            request.get({
                url,
                encoding: null,
            })
            .then((photoRes) => {
                fs.writeFile(`photos/${userId}.jpg`, Buffer.from(photoRes, 'utf8'), (error) => {
                    if (error) {
                        Community.sendMessage({
                            peer_id: userId,
                            message: config.responseMessages.error,
                        }, 'photoSaveError').catch(() => {});
                        return reject({ reason: 'photoSaveError' });
                    }
                    resolve(`photos/${userId}.jpg`);
                });
            })
            .catch((error) => {
                Community.sendMessage({
                    peer_id: userId,
                    message: config.responseMessages.error,
                }, 'photoDownloadError').catch(() => {});
                reject({ reason: 'photoDownloadError' });
            });
        })
        .catch((error) => {
            Community.sendMessage({
                peer_id: userId,
                message: config.responseMessages.error,
            }, 'contentTypeRequestError').catch(() => {});
            reject({ reason: 'contentTypeRequestError' });
        });
    });
};

const handleMessage = (userId, text, message) => {
    log.info('Processing message', message);

    Community.isMember(userId)
    .catch((error) => {
        if (error.reason === 'notMember') {
            Community.sendMessage({
                peer_id: userId,
                message: config.responseMessages.notMember,
            }, 'notMember').catch(() => {});
        }
        throw error;
    })
    .then(() => {
        return redisClient.get(`${config.appName}:${userId}_status`);
    }, (error) => { throw error; })
    .then((status) => {
        switch (Number(status)) {
            case 1:
                Community.sendMessage({
                    peer_id: userId,
                    message: config.responseMessages.onBusy,
                }, 'onBusy').catch(() => {});
                return Promise.reject({ reason: 'onBusy' });

            case 2:
                Community.sendMessage({
                    peer_id: userId,
                    message: config.responseMessages.onCooldown,
                }, 'onCooldown').catch(() => {});
                return Promise.reject({ reason: 'onCooldown' });

            default:
                return Promise.resolve();
        }
    }, (error) => { throw error; })
    .then(() => {
        return new Promise((resolve, reject) => {
            Service.active.api.wall.get({
                owner_id: userId,
                count: 3,
            })
            .then((posts) => {
                if (JSON.stringify(posts).indexOf(`"owner_id":-${config.community.id}`) === -1) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            })
            .catch(() => {
                resolve(false);
            });
        });
    }, (error) => { throw error; })
    .then((hasRepost) => {
        if (!hasRepost) {
            Community.sendMessage({
                peer_id: userId,
                message: config.responseMessages.noRepost,
            }, 'noRepost').catch(() => {});
            return Promise.reject({ reason: 'noRepost' });
        }
    }, (error) => { throw error; })
    .then(() => {
        return new Promise((resolve, reject) => {
            Community.active.api.messages.getHistory({
                peer_id: userId,
                count: 1,
                start_message_id: message.id,
                photo_sizes: 1,
            })
            .then((messages) => {
                if (messages.items[0].attachments && messages.items[0].attachments[0].photo) {
                    const photos = messages.items[0].attachments[0].photo.sizes;
                    const photoData = photos[photos.length - 1];
                    if (photoData.width < 200 || photoData.height < 200) {
                        Community.sendMessage({
                            peer_id: userId,
                            message: config.responseMessages.invalidPhotoSize,
                        }, 'invalidPhotoSize').catch(() => {});
                        reject({ reason: 'invalidPhotoSize' });
                    } else {
                        // redisClient.set(`${config.appName}:${userId}_status`, 1);
                        // redisClient.expire(`${config.appName}:${userId}_status`, 760000);
                        Community.sendMessage({
                            peer_id: userId,
                            message: config.responseMessages.beginProcessing,
                        }, 'beginProcessing').catch(() => {});
                        resolve(photoData.src);
                    }
                } else {
                    Community.sendMessage({
                        peer_id: userId,
                        message: config.responseMessages.noPhoto,
                    }, 'noPhoto').catch(() => {});
                    reject({ reason: 'noPhoto' });
                }
            })
            .catch(reject);
        });
    }, (error) => { throw error; })
    .then((photoUrl) => {
        return DownloadImage(photoUrl, userId);
    }, (error) => { throw error; })
    .then((photoFile) => {
        return new Promise((resolve, reject) => {
            request({
                url: 'http://vinci.camera/preload',
                method: 'POST',
                headers: {
                    'User-Agent': config.appName,
                    'content-type': 'multipart/form-data',
                },
                formData: {
                    filename: fs.createReadStream(photoFile),
                },
                timeout: 60000,
            })
            .then((response) => {
                console.log(response);
                resolve(`http://vinci.camera/process/${JSON.parse(response).preload}/${config.photoFilterId}`);
            })
            .catch((error) => {
                Community.sendMessage({
                    peer_id: userId,
                    message: config.responseMessages.error,
                }, 'unableToPOSTVinci').catch(() => {});
                reject({ reason: 'unableToPOSTVinci' });
            });
        });
    }, (error) => { throw error; })
    .then((processedUrl) => {
        console.log(processedUrl);
    })
    .catch((error) => {
        if (error.reason) {
            return;
        }

        Community.sendMessage({
            peer_id: userId,
            message: config.responseMessages.error,
        }, 'error').catch(() => {});

        log.error(userId, 'Error occured:', error);
    });
};

Community.messages.process((job, done) => {
    done();
    handleMessage(job.data.user, job.data.text, job.data);
});

process.on('unhandledRejection', (error) => {
    log.error('Unhandled rejection:', error);
    console.log(error);
});
