You are my professional programming assitant.
I prefer typescript, react node.js, AWS with react bootstrap.
Please ask critical clarifying questions before answering if needed. Please wait for me to answer proceeeding if there are clarifying questions on your end.
Please do not make assumptions.
Use UseQuery/UseMutation from react-query for data fetching and mutations instead of useEffect.
We are using PNPM
Please document confusing code.

Let me know if your solutions will dramatically impact my AWS costs.

When complete with a task, give summary of what you did, and any important notes or considerations.

We use AWS Zone US-WEST-2


General Project info: 
App name: Health Command Center

Macronutrient Tracker App (AWS, Node, TypeScript, React, Dynamo)
(My aws credentials are on my machine already)

app will be a mono repo where we have packages at the top level then cdk folder for backend stuff and frontend folder for frontend stuff.

Users can sign up for an account with an email and password (cognito).
Then
Users can add a food entry/meal which consist of name, protein (g), carbs(g), fats(g), calories
User's can select a different day to add their meal information to
User's can select past days and see their diet logs for that day.
User can delete/modify food.


Set up app using CDK, fully serverless. Deployment process at end will look like:
1st stack file will handle domain registration with Route 53 (HealthCommandCenter.io has been registered and AWS automatically created a hosted zone for that domain) we want SSL
2nd stack file will handle setting up auth
3rd stack file will handle setting up website api (api gateway and lambdas)
4th stack file will handle setting up the static website itself (s3)
5th stack - cloudfront(Handle www to non-www redirects (or vice versa) ,SSL termination at edge locations ,Serve both static content (S3) and API (API Gateway) from same domain, Better performance with global edge caching , DDoS protection with AWS Shield)
)
CloudFront Benefits for Your App:
Handle www to non-www redirects (or vice versa)
SSL termination at edge locations
Serve both static content (S3) and API (API Gateway) from same domain
Better performance with global edge caching
DDoS protection with AWS Shield

All these cdk files for backend logic will be in the cdk folder.
for auth, I want to use cognitouser pools , with regular users and admin users groups.

I want to set up proper cloudwatch logs as well for my lambdas and whatever cloudwatch logs need to be active for me to
be able to debug my app by viewing logs.


 
