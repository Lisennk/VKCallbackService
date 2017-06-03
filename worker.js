const config = require(`./${process.argv[2]}`);

const queue = require('bull');
const VK = require('vk-io');
const Logger = require('./components/logger');

const eventsQueue = queue(config.eventsQueue, config.redis);
const log = new Logger('Worker');

const processEvent = (queryData, eventData) => {
    if (!queryData[eventData.type]) {
        return;
    }
    
    log.info('Processing event', queryData, '\n\n', eventData);

    try {
        const Community = new VK({
            token: queryData.token,
        });

        Community.api.messages.send({
            peer_id: eventData.object.user_id || eventData.object.owner_id,
            message: queryData[eventData.type],
        })
        .then(() => {
        })
        .catch((e) => {
            log.info('Error responding to event', e);
        });
    } catch (e) {
        log.info('Error responding to event', e);
    }
}

eventsQueue.process((job, done) => {
    done();
    processEvent(job.data.queryData, job.data.eventData);
});

