const donators = require('./donators.json');
const jsonConfig = require('./config.json');

const mongoose = require('mongoose');
const axios = require('axios');

const playerModel = mongoose.model('players', {
    _id: String,
    donator: Boolean,
    donatorType: String,
    mojangUUID: String,
    expires: Number,
    lastSplashRequest: Number,
    lastPotionRequest: Number,
    verified: Boolean
});

mongoose.connect(jsonConfig.mongodb);

donators.forEach(async (donator, index) => {
    const response = await axios(`https://mc-heads.net/minecraft/profile/${donator.username}`);
    const id = response.data.id;

    let time = new Date(donator.donation_date).getTime();

    if (donator.tier === 'Weekly') {
        time = time + (86400000 * 7);
    } else if (donator.tier === 'Monthly') {
        time = time + (86400000 * 30);
    } else if (donator.tier === 'infinite') {
        time = time + (86400000 * 999999);
    }

    await playerModel.findByIdAndUpdate(donator.userid, {
        _id: donator.userid,
        mojangUUID: id,
        donatorType: donator.tier.toLowerCase(),
        donator: true,
        expires: time,
    }, { upsert: true });

    console.log(`${index}/${donators.length}`);
});