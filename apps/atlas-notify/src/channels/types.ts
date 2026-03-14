export interface DeliveryResult {
  success: boolean;
  error?: string;
}

export interface ChannelDeliverer {
  type: string;
  deliver(config: Record<string, unknown>, notification: { title?: string; subject?: string; body?: string }): Promise<DeliveryResult>;
}
