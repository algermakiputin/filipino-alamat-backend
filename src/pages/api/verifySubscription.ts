import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

const PACKAGE_NAME = "com.angalamat";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  const { subscriptionId, purchaseToken } = req.body;

  if (!subscriptionId || !purchaseToken) {
    return res
      .status(400)
      .json({ error: "subscriptionId and purchaseToken are required" });
  }

  try {
    const jwtClient = new JWT({
      // keyFile: "./service-account.json",
      email: process.env.SERVER_SIDE_CLIENT_EMAIL,
      key: process.env.SERVER_SIDE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });

    await jwtClient.authorize();

    const androidPublisher = await google.androidpublisher({
      version: "v3",
      auth: jwtClient,
    });

    const response = await androidPublisher.purchases.subscriptions.get({
      packageName: PACKAGE_NAME,
      subscriptionId: subscriptionId,
      token: purchaseToken,
    });

    if (response?.data?.acknowledgementState === 0) {
      const acknowledge =
        await androidPublisher.purchases.subscriptions.acknowledge({
          packageName: PACKAGE_NAME,
          subscriptionId: subscriptionId,
          token: purchaseToken,
          requestBody: {
            developerPayload: "Acknowledged via backend verification",
          },
        });
      console.log(`acknowledge: `, acknowledge);
    }

    const isActive =
      response.data.paymentState === 1 &&
      response.data.expiryTimeMillis &&
      Number(response.data.expiryTimeMillis) > Date.now();

    res.status(200).json({
      isActive,
      acknowledge: true,
      expiryTime: Number(response.data.expiryTimeMillis),
      raw: response.data,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.log(`error: `, error);
    if (error?.response?.data) {
      return res.status(error?.response?.status || 500).json({
        error: error.response.data.error || "Google API error",
      });
    }
    return res
      .status(500)
      .json({ error: error?.message || "Internal server error" });
  }
}
