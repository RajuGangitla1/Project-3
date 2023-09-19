import mongoose from "mongoose";
import express from "express"
import userAccounts from "./userAccountsSchema.js"
import schedulePostModel from "./schedulePostSchema.js"
import { Storage } from "@google-cloud/storage"
import axios from "axios"
import StorageKey from "./GCPkey.json" assert { type: "json" };
const storage = new Storage({
    projectId: StorageKey.project_id,
    credentials: {
        client_email: StorageKey.client_email,
        private_key: StorageKey.private_key,
    },
});

const bucket = 'testing_joolt1';


const app = express();

const connectDb = async () => {
    try {
         await mongoose.connect("mongodb+srv://root:root@development.1qgn5.mongodb.net/?retryWrites=true&w=majority")
        console.log("Db connected")
    } catch (error) {
        console.log(error)
    }
};

async function getTokenAccountsByScope(scope) {
    try {
        const user = await userAccounts.aggregate([
            {
                $match: { scope: scope },
            },
            {
                $project: {
                    belongsTo: 1,
                    scope: 1,
                    refresh_token: 1,
                },
            },
        ]);

        if (user.length > 0) {
            return user;
        } else {
            throw new Error(`User's ${scope} account not connected`);
        }
    } catch (error) {
        console.log("getTokenAccountsByScope", err.message)
        throw error;
    }
}


async function getFaceBookPageID(token) {
    try {
        let res = await axios.get(`https://graph.facebook.com/v17.0/me/accounts?access_token=${token}`);
        if (res?.data?.data[0]?.id) {
            return { id: res?.data?.data[0]?.id, access_token: res?.data?.data[0]?.access_token };
        }
        else
            console.log("No id found, check for proper access token")
            throw new BadRequestException("No id found, check for proper access token")
    }
    catch (err) {
        console.log("getFaceBookPageID", err.message)
        return err.message
    }
}

async function getInstagramBussinessID(token) {
    try {
        const pageID = await getFaceBookPageID(token)
        const { data } = await axios.get(
            "https://graph.facebook.com/v17.0/" + pageID?.id + "?fields=instagram_business_account&access_token=" + pageID?.access_token
        )
        if (!data?.instagram_business_account?.id) {
            console.log("instagram_business_account")
            throw new BadRequestException("no instagram_business_account connect with this account")
        }
        return { id: data?.instagram_business_account?.id, access_token: pageID?.access_token }
    } catch (err) {
        console.log("getInstagramBussinessID", err.message)
        throw new Error(err.message);
    }
}

async function postToInstagram(content) {
    try {
        const userToken = await getTokenAccountsByScope("instagram")
        const token = userToken[0]?.refresh_token
        const accoutId = await getInstagramBussinessID(token);
        const encodedMessage = encodeURIComponent(content?.message)
        const encodedUrl = encodeURIComponent(content.mediaUrl);
        let data;
        console.log(encodedUrl)
        if (content?.type.split('/')[0] === "video"){
            data = await axios.post(
                `https://graph.facebook.com/v17.0/${accoutId?.id}/media?media_type=VIDEO&video_url=${encodedUrl}&caption=${encodedMessage}&access_token=${accoutId?.access_token}`
            )
        }
        if (content?.type.split('/')[0] === "image"){
            data = await axios.post(
                `https://graph.facebook.com/v17.0/${accoutId?.id}/media?image_url=${encodedUrl}&caption=${encodedMessage}&access_token=${accoutId?.access_token}`
            )
        }
        
        return data
    } catch (err) {
        console.log("postToInstagram", err.message)
        return err.message
    }

}

async function publishInstagramPost(creation_id) {
    try {
        const userToken = await getTokenAccountsByScope("instagram")
        console.log("creation_id", creation_id)
        const token = userToken[0]?.refresh_token
        const accoutId = await getInstagramBussinessID(token);
        const data = await axios.post(
            `https://graph.facebook.com/v17.0/${accoutId?.id}/media_publish?creation_id=${creation_id}&access_token=${accoutId?.access_token}`
        )
        return data
    } catch (err) {
        console.log("publishInstagramPost", err.message)
        throw new Error(err.message);
    }
}

async function createFaceBookPagePost(content) {
    try {
        const userToken= await getTokenAccountsByScope("facebook")
        const token = userToken[0]?.refresh_token
        const pageID = await getFaceBookPageID(token); 
        const encodedMessage = encodeURIComponent(content?.message)
        const encodedUrl = encodeURIComponent(content.mediaUrl);
        if (content?.type.split('/')[0] === "image") {
            // photos ? access_token = <access-token >& url=<image url >& message=<message>
            const { data: res } = await axios.post(
                `https://graph.facebook.com/${pageID.id}/photos?url=${encodedUrl}&message=${encodedMessage}&access_token=${pageID?.access_token}`
            ).catch(({ response }) => console.log(response?.data))

            console.log("fb res", res)
            return res
        }
        if (content?.type.split('/')[0] === "video"){
            const { data: res } = await axios.post(
                `https://graph.facebook.com/${pageID.id}/videos?url=${encodedUrl}&message=${encodedMessage}&access_token=${pageID?.access_token}`
            ).catch(({ response }) => console.log(response?.data))

            console.log("fb res", res)
            return res
        }
        const { data: res } = await axios.post(
            `https://graph.facebook.com/${pageID?.id}/feed?message=${content?.message}&access_token=${pageID?.access_token}`
        );
        console.log("fb res", res)
        return res
    }
    catch (error) {
        throw new Error(error.message);

    }
}

async function generateSignedUrl(path) {
    try {
        if (path) {
            const fileResponse = await storage.bucket(bucket).file(path).exists();

            if (fileResponse[0]) {
                const [url] = await storage
                    .bucket(bucket)
                    .file(path)
                    .getSignedUrl({
                        responseDisposition:"attachment",
                        version: "v4",
                        action: "read",
                        expires: Date.now() + 100 * 60 * 1000,
                        // virtualHostedStyle:true
                    });
                return url;
            } else {
                throw new Error("Image not found");
            }
        }
        throw new Error("Image path not found");
    } catch (error) {
        console.log("publishInstagramPost", error.message)
        throw error;
    }
}


async function UpdateSchedulePost(id, schedulePostDTO) {
    try {
        let postexist = await schedulePostModel.findById(id)
        if (!postexist) {
            return "Post not exixt"
        }
        let result = await schedulePostModel.findByIdAndUpdate(id, schedulePostDTO)
        console.log("posted success")
        return result
    } catch (error) {
        console.log("err ==>UpdateSchedulePost", error.message)
        return {
            code: 400,
            message: error.message,
        }
    }
}

async function publishSocialMediaPosts(){
    await connectDb()
    let posts = await schedulePostModel.aggregate([
        {
            $match: {
                $or: [
                    {
                        ScheduledDate: {
                            $gte: new Date(),
                            $lt: new Date(new Date().getTime() + 5 * 60 * 1000),
                        },
                    },
                    {
                        status: "Scheduled"
                    }
                ]
            },
        },
        {
            $lookup: {
                from: "userfiles",
                localField: "_id",
                foreignField: "parentObjectId",
                as: "result",
            },
        },
        {
            $unwind: "$result",
        },
        {
            $set: {
                mediaUrl: "$result.path",
                type: "$result.type"
            },
        },
        {
            $unset: ["result"],
        },
    ])
    console.log("length", posts.length )


    await Promise.all(posts.map(async (post) => {
        const updatedMediaUrl = await generateSignedUrl(post.mediaUrl);
        const content = {
            _id: post._id,
            message: post.message,
            mediaUrl: updatedMediaUrl,
            ScheduledDate: post.ScheduledDate,
            platform: post.platform,
            type:post.type
        };

        try {
            if (post.platform === "FaceBook" && post.status === "Scheduled" ) {

                let res = await createFaceBookPagePost(content);
                if (res?.id) {
                    // Update post status on success
                    const completePostData = {
                        message: content.message,
                        ScheduledDate: content.ScheduledDate,
                        platform: content.platform,
                        status: 'Posted'
                    };
                    await UpdateSchedulePost(post._id, completePostData);
                }
            } else if (post.platform === "Instagram" && post.status === "Scheduled" ) {
               if (post?.scheduledId) {
                    let result = await publishInstagramPost(post?.scheduledId)
                    if (result?.data?.id) {
                        // Update post status on success
                        const completePostData = {
                            message: content.message,
                            ScheduledDate: content.ScheduledDate,
                            platform: content.platform,
                            status: 'Posted'
                        };
                        await UpdateSchedulePost(content._id, completePostData);
                    }
                }
            }
        } catch (error) {
            console.error("Error publishing post:", error);
        }
    }));

}
const port = process.env.PORT || 4000;

app.listen(port, async () => {
    console.log(`Server is running on ${port}`);
    await publishSocialMediaPosts();
}); 
