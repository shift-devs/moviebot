import { APIInteractionGuildMember, APIUser, BaseInteraction, Client, CommandInteraction, DMChannel, GatewayIntentBits, Guild, GuildMember, GuildTextBasedChannel, Interaction, Message, MessagePayload, PermissionsBitField, User, userMention } from "discord.js";
import { REST, Routes } from 'discord.js';

// Setup the global logger
const createLogger = require('logging')
export const log = createLogger.default('memebot2.1')

// Setup globals
var CHANNEL_ID = null;
const KEYWORD = "movie";
const CLIENT_ID = process.env.MEMEBOT2_CLIENT_ID;
const TOKEN = process.env.MEMEBOT2_TOKEN;
const COMMANDS = [
    {
        name: 'setmoviechannel',
        description: 'Set channel for movie counter.',
        default_member_permissions: '268435456'
    },
];

async function handle_set_movie_channel(command: CommandInteraction) {
    const commandName: String = command.commandName;
    const channelName: GuildTextBasedChannel = command.channel;
    const guildName: Guild = command.guild;
    const user: GuildMember = command.member as GuildMember;
    const permissions: Readonly<PermissionsBitField> = command.memberPermissions;

    log.info(`Got /${commandName} in ${guildName}@${channelName} from ${user.displayName}`);

    log.info(`User has the following permissions:\n${permissions.toArray()}`);

    CHANNEL_ID = command.channelId;
    log.info(`Now listening for the term \"${KEYWORD}\" in <#${CHANNEL_ID}>`);
    command.reply(`Will nowlisten for \`${KEYWORD}\` in <#${CHANNEL_ID}> !`);
}

async function handle_message_recv() {

}

async function main() {
    // Register commands
    try {
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: COMMANDS })
    } catch (error) { console.error(error); }

    const bot = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.DirectMessages
        ]
    });

    // Setup event handlers
    bot.on('ready', () => {
        log.info(`Bot logged in as ${bot.user.tag}`);
    });

    bot.on('interactionCreate', async (interaction: BaseInteraction) => {
        if (!interaction.isCommand()) { return; }
        const command: CommandInteraction = (interaction as CommandInteraction);

        switch (command.commandName) {
            case "setmoviechannel": {
                handle_set_movie_channel(interaction as CommandInteraction);
                break;
            }
            default: { interaction.reply("Unknown command"); }
        }
    });

    bot.on('messageCreate', async (message) => {
        log.info(`[${message}]: `);
    });

    // Login and start the bot
    bot.login(TOKEN);
}

// Send it
main()
    .then(() => { })
    .catch(log.error)