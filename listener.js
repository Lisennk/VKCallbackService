const config = require(`./${process.argv[2]}`);

const http = require('http');
const queue = require('bull');
const url = require('url') ;
const fs = require('fs');
const Logger = require('./components/logger');

const log = new Logger('Listener');

http.createServer((request, response) => {

    let body = '';

    request.on('data', (chunk) => {
        body += chunk;
    });

    request.on('end', () => {
        const requestPath = url.parse(request.url, true).pathname;

        log.info('Got request to', requestPath);

        switch (requestPath) {
            case '/catch': 
                let queryData = {};
                let eventData = {};
                try {
                    queryData = JSON.parse(Buffer.from(url.parse(request.url,true).query.params, 'base64'));
                    eventData = JSON.parse(body);

                    log.info('queryData:', queryData, '\neventData', eventData);
                    response.writeHead(200, {});

                    if (eventData.type === 'confirmation') {
                        log.info('Sent confirmation string from eventData');
                        return response.end(queryData.confirmation);
                    } else if (eventData.secret === queryData.secret && eventData.group_id === queryData.group_id) {
                        log.info('Secret and group_id for event match');
                        queue(config.eventsQueue, config.redis).add({
                            queryData,
                            eventData,
                        }, {
                            removeOnComplete: true,
                            removeOnFail: true,
                        });
                    } else {
                        log.info('Secret and group_id for event do not match');
                    }
                } catch (e) {
                    log.info('Couldn\'t extract query data');
                    response.writeHead(404, {});
                }

            case '/generate': 
                return fs.createReadStream('generate.html').pipe(response);

            default: 
                response.writeHead(301, {
                    Location: 'https://vk.com/liskabots'
                });
        }
        return response.end();
    });

}).listen(config.web.port, config.web.ip);
