import "dotenv/config";
import { betterAuth } from "better-auth";
import pg from "pg";

const { Pool } = pg;

const socialProviders =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
              google: {
                  clientId: process.env.GOOGLE_CLIENT_ID,
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              },
          }
        : undefined;

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

export const auth = betterAuth({
    appName: "profkom-chat",
    baseURL: process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.SERVER_PORT ?? 3001}`,
    trustedOrigins: (request) => {
        const origin = request?.headers.get("origin");
        const localViteOrigin = origin?.match(/^http:\/\/(localhost|127\.0\.0\.1):517\d$/)
            ? origin
            : undefined;

        return [
            clientOrigin,
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            localViteOrigin,
        ];
    },
    database: new Pool({
        connectionString: process.env.DATABASE_URL,
    }),
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 6,
    },
    socialProviders,
    user: {
        modelName: "users",
        fields: {
            name: "full_name",
            emailVerified: "email_verified",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
        additionalFields: {
            role: {
                type: "string",
                defaultValue: "student",
                input: false,
            },
            studentCard: {
                type: "string",
                required: false,
                fieldName: "student_card",
            },
            studyForm: {
                type: "string",
                required: false,
                fieldName: "study_form",
            },
            group: {
                type: "string",
                required: false,
                fieldName: "student_group",
            },
            course: {
                type: "string",
                required: false,
            },
            educationLevel: {
                type: "string",
                required: false,
                fieldName: "education_level",
            },
            edsEnabled: {
                type: "boolean",
                required: false,
                defaultValue: false,
                fieldName: "eds_enabled",
            },
            edsCertificateName: {
                type: "string",
                required: false,
                fieldName: "eds_certificate_name",
            },
            edsCertificateSerial: {
                type: "string",
                required: false,
                fieldName: "eds_certificate_serial",
            },
            edsConnectedAt: {
                type: "string",
                required: false,
                fieldName: "eds_connected_at",
            },
        },
    },
});
