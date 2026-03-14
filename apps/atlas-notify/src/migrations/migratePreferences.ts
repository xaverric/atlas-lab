import mongoose from 'mongoose';
import { NotificationChannel } from '../models/NotificationChannel.js';
import { NotificationPreference } from '../models/NotificationPreference.js';

export const migratePreferences = async () => {
  const collection = mongoose.connection.collection('notificationpreferences');
  const oldDocs = await collection.find({ 'channels.email': { $exists: true } }).toArray();

  if (oldDocs.length === 0) return;

  console.log(`Migrating ${oldDocs.length} legacy preference docs...`);

  for (const doc of oldDocs) {
    const userId = doc.userId as string;

    const existingChannels = await NotificationChannel.countDocuments({ userId });
    if (existingChannels > 0) continue;

    const channelIds: mongoose.Types.ObjectId[] = [];
    const channels = doc.channels as Record<string, Record<string, unknown>> | undefined;

    if (channels?.email?.address) {
      const ch = await NotificationChannel.create({
        userId,
        type: 'email',
        label: 'Email',
        config: { address: channels.email.address },
        verified: true,
        enabled: !!channels.email.enabled,
      });
      channelIds.push(ch._id as mongoose.Types.ObjectId);
    }

    if (channels?.telegram?.chatId) {
      const ch = await NotificationChannel.create({
        userId,
        type: 'telegram',
        label: 'Telegram',
        config: { chatId: channels.telegram.chatId },
        verified: true,
        enabled: !!channels.telegram.enabled,
      });
      channelIds.push(ch._id as mongoose.Types.ObjectId);
    }

    // in_app channel for every user
    const inApp = await NotificationChannel.create({
      userId,
      type: 'in_app',
      label: 'In-App',
      config: {},
      verified: true,
      enabled: true,
    });
    channelIds.push(inApp._id as mongoose.Types.ObjectId);

    await NotificationPreference.create({
      userId,
      eventPattern: '*',
      channelIds,
      enabled: true,
    });

    await collection.deleteOne({ _id: doc._id });
  }

  console.log('Migration complete');
};
