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
                    queryData = JSON.parse(decodeURIComponent(Buffer.from(url.parse(request.url,true).query.params, 'base64')));
                    eventData = JSON.parse(body);

                    log.info('queryData:', queryData, '\neventData', eventData);

                    if (eventData.type === 'confirmation') {
                        log.info('Sent confirmation string from queryData');
                        response.writeHead(200, { 'Content-type':'text/plain' });
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
                       response.writeHead(200, {});
                       response.end('OK');
                    } else {
                        log.info('Secret and group_id for event do not match');
                        response.writeHead(400, {});
                        return response.end('BAD');
                    }                
                } catch (e) {
                    log.info('Couldn\'t extract query data');
                    response.writeHead(400, {});
                    return response.end('BAD');
                }
                break;

            case '/generate': 
                return fs.readFile('generate.html', (error, data) => {
                   response.writeHead(200, { 'Content-type':'text/html' });
                   response.end(data);
                });

            default: 
                response.writeHead(400, {});
                return response.end('BAD');
        }
    });

}).listen(config.web.port, config.web.ip);
