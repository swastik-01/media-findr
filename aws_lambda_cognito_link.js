import { CognitoIdentityProviderClient, ListUsersCommand, AdminLinkProviderForUserCommand } from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

export const handler = async (event) => {
    // We only care about linking External Provider sign-ins (like Google)
    if (event.triggerSource === 'PreSignUp_ExternalProvider') {
        const email = event.request.userAttributes.email;
        const userPoolId = event.userPoolId;
        
        // 1. Check if a native (Email/Password) user already exists with this email
        const listUsersCommand = new ListUsersCommand({
            UserPoolId: userPoolId,
            Filter: `email = "${email}"`,
            Limit: 1
        });
        
        try {
            const response = await client.send(listUsersCommand);
            
            // 2. If a native user exists, link the incoming Google identity to it
            if (response.Users && response.Users.length > 0) {
                const existingUser = response.Users[0];
                
                // Extract the provider name and provider user ID from the event
                // userName looks like: "google_113984188004087257180"
                let providerName = event.userName.split('_')[0]; // e.g., "google"
                
                // AWS requires the ProviderName to be capitalized (e.g. "Google", "Facebook")
                providerName = providerName.charAt(0).toUpperCase() + providerName.slice(1);
                
                const providerUserId = event.userName.split('_').slice(1).join('_'); // e.g., "1139..."
                
                console.log(`Linking existing user ${existingUser.Username} to ${providerName} ID ${providerUserId}`);
                
                const linkCommand = new AdminLinkProviderForUserCommand({
                    UserPoolId: userPoolId,
                    DestinationUser: {
                        ProviderName: 'Cognito',
                        ProviderAttributeValue: existingUser.Username // The original native UUID
                    },
                    SourceUser: {
                        ProviderName: providerName,
                        ProviderAttributeName: 'Cognito_Subject',
                        ProviderAttributeValue: providerUserId
                    }
                });
                
                await client.send(linkCommand);
                
                // IMPORTANT: Tell Cognito that the email is verified to prevent issues
                event.response.autoVerifyEmail = true;
                event.response.autoVerifyPhone = true;
            }
        } catch (error) {
            console.error("Error linking users:", error);
        }
    }
    
    return event;
};
