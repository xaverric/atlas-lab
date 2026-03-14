import { NotificationPreference } from '../models/NotificationPreference.js';
import { matchPattern } from '@atlas/event-bus';

export const findRulesForUser = (userId: string, isAdmin = false) =>
  NotificationPreference.find(isAdmin ? {} : { userId }).populate('channelIds');

export const findMatchingRules = async (userId: string, event: string) => {
  const rules = await NotificationPreference.find({ userId, enabled: true }).populate('channelIds');
  return rules.filter((r) => matchPattern(r.eventPattern, event));
};

export const createRule = (data: Record<string, unknown>) =>
  NotificationPreference.create(data);

export const updateRule = (id: string, data: Record<string, unknown>) =>
  NotificationPreference.findByIdAndUpdate(id, data, { new: true });

export const deleteRule = (id: string, userId: string) =>
  NotificationPreference.findOneAndDelete({ _id: id, userId });
