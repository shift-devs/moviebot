import { ArgumentParser } from 'argparse'
import { name, description, version } from '../package.json'
import { APIInteractionGuildMember, APIUser, BaseInteraction, Client, CommandInteraction, DMChannel, GatewayIntentBits, Guild, GuildMember, GuildTextBasedChannel, Interaction, Message, MessagePayload, PermissionsBitField, TextChannel, User, userMention } from "discord.js";
import { REST, Routes } from 'discord.js';
import { RedisClientType, createClient } from 'redis';
import { match } from 'assert';

// Setup the global logger
const createLogger = require('logging')
export const log = createLogger.default('memebot2.1')

// Setup globals
const KEYWORD = "movie";
const LEADERBOARD_MAX = 16;
const CHANNEL_ID_KEY = "movie-channel";
const CLIENT_ID = process.env.MEMEBOT2_CLIENT_ID;
const TOKEN = process.env.MEMEBOT2_TOKEN;
const COMMANDS = [
    {
        name: 'set-movie-channel',
        description: 'Set channel for movie counter.',
        default_member_permissions: '268435456'
    },
    {
        name: 'my-count',
        description: 'Get your movie counter.'
    },
    {
        name: 'leaderboard',
        description: 'All-time leaderboards for movie.'
    }
];

async function handle_set_movie_channel(command: CommandInteraction, db: RedisClientType) {
    const commandName: String = command.commandName;
    const channelName: GuildTextBasedChannel = command.channel;
    const guildName: Guild = command.guild;
    const user: GuildMember = command.member as GuildMember;
    const permissions: Readonly<PermissionsBitField> = command.memberPermissions;

    log.info(`Got /${commandName} in ${guildName}@${channelName} from ${user.displayName}`);

    log.info(`User has the following permissions:\n${permissions.toArray()}`);

    db.set(CHANNEL_ID_KEY, command.channelId);
    const channelId: string = await db.get(CHANNEL_ID_KEY);
    log.info(`Now listening for the term \"${KEYWORD}\" in <#${channelId}>`);
    command.reply(`Will now listen for \`${KEYWORD}\` in <#${channelId}> !`);
}

async function handle_get_movie_counter(command: CommandInteraction, db: RedisClientType) {
    const commandName: String = command.commandName;
    const channelName: GuildTextBasedChannel = command.channel;
    const guildName: Guild = command.guild;
    const user: GuildMember = command.member as GuildMember;
    const permissions: Readonly<PermissionsBitField> = command.memberPermissions;

    log.info(`Got /${commandName} in ${guildName}@${channelName} from ${user.displayName}`);  
    const counter: any = await db.get(user.id);
    if(counter === null) {
        command.reply(`You haven't said \`${KEYWORD}\` in this channel yet!`);
        return;
    }
    command.reply(`You've said \`${KEYWORD}\` ${counter} times!`);
}

async function handle_get_leaderboard(command: CommandInteraction, db: RedisClientType) {
    const commandName: String = command.commandName;
    const channelName: GuildTextBasedChannel = command.channel;
    const guildName: Guild = command.guild;
    const user: GuildMember = command.member as GuildMember;
    log.info(`Got /${commandName} in ${guildName}@${channelName} from ${user.displayName}`);

    let users = [];
    const re = new RegExp('^[0-9]+$');
    for await (const key of db.scanIterator()) {
        if(re.test(key)) {
            try {
                users.push([key, parseInt(await db.get(key))]);
            } catch(err) { log.error(err); }
        }
    }
    users.sort(([,a], [,b]) => a - b).reverse();
    const leaderboardSize = (users.length < LEADERBOARD_MAX) ? users.length : LEADERBOARD_MAX;
    log.info(`Found ${leaderboardSize} users for the leaderboard!`);

    var message = "```\nAll-Time MovieMadness Leaderboard:\n----------------------------------\n\n";
    for(let i = 0; i < leaderboardSize; i++) {
        const entry = users[i]; // Get the tuple
        
        // Fetch the username
        const user: User = await command.client.users.fetch(entry[0]);
        const username: string = user.tag;

        // Append to leaderboard string
        message += `${i + 1}. ${username} (${entry[1]} times)\n`
    }
    message += "```\n"
    await command.reply(message);
}

async function handle_message_recv(message: Message, db: RedisClientType) {
    const guild: Guild = message.guild as Guild;
    const channel: TextChannel = message.channel as TextChannel;
    const user: User = message.author as User;
    const content: string = message.content;

    // Get the channel ID to listen on
    const channelId: string = await db.get(CHANNEL_ID_KEY);
    if (channelId === null) {
        log.warn(`Channel ID is not set in the DB yet!`);
        return;
    } else if (channel.id !== channelId.toString()) { return; }

    // Ignore if the message is from a bot
    if(user.bot) {
        return;
    }

    // Check if movie was said
    const matches = content.match(/movie/ig);
    log.info(`Got ${matches.length} results: ${matches}`);
    if (matches.length > 0) {
        log.info(`[${user.tag} in <${guild.name}#${channel.name}>]: \"${content}\"`);
        for (let i = 0; i < matches.length; i++) {
            await db.incr(user.id);
        }
    }
}

export async function main() {
    // setup argparser
    const parser = new ArgumentParser({
        'prog': name,
        'description': description
    })
    const args = parser.parse_args()

    // Establish redis connection
    const db: RedisClientType = createClient({
        url: "redis://localhost:6379"
    });
    db.on('error', err => log.error);
    await db.connect();

    // Register commands
    try {
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: COMMANDS })
    } catch (error) { console.error(error); }

    const bot = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    // Setup event handlers
    bot.on('ready', async () => {
        log.info(`Bot logged in as ${bot.user.tag}`);
        const channelId: any = await db.get(CHANNEL_ID_KEY);
        if (channelId === null) {
            log.warn("Movie Channel ID has not yet been set!");
        } else {
            log.info(`Listening for \"${KEYWORD}\" in <#${channelId}>`);
        }
    });

    bot.on('interactionCreate', async (interaction: BaseInteraction) => {
        if (!interaction.isCommand()) { return; }
        const command: CommandInteraction = (interaction as CommandInteraction);

        switch (command.commandName) {
            case 'set-movie-channel': {
                handle_set_movie_channel((interaction as CommandInteraction), db);
                break;
            }
            case 'my-count': {
                handle_get_movie_counter((interaction as CommandInteraction), db);
                break;
            }
            case 'leaderboard': {
                handle_get_leaderboard((interaction as CommandInteraction), db);
                break;
            }
            default: { interaction.reply("Unknown command"); }
        }
    });

    bot.on('messageCreate', async (message: Message) => {
        handle_message_recv(message, db);
    });

    // Login and start the bot
    bot.login(TOKEN);
}

// Send it
main()
    .then(() => { })
    .catch(log.error)