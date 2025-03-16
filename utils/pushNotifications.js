const axios = require('axios');

exports.sendPushNotification = async ({ to, title, body, data = {} }) => {
    try {
        await axios.post('https://exp.host/--/api/v2/push/send', {
            to,
            title,
            body,
            data,
            sound: 'default',
            priority: 'high',
        }, {
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            }
        });
    } catch (error) {
        console.error('Push notification error:', error);
        // Don't throw the error as push notification failure shouldn't break the app flow
    }
}; 