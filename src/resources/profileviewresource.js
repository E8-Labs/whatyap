import db from "../models/index.js";
import UserProfileLiteResource from "./userprofileliteresource.js";

const Op = db.Sequelize.Op;

const UserProfileViewResource = async (user, currentUser = null) => {
    if (!Array.isArray(user)) {
        //////console.log("Not array")
        return await getUserData(user, currentUser);
    }
    else {
        //////console.log("Is array")
        const data = []
        for (let i = 0; i < user.length; i++) {
            const p = await getUserData(user[i], currentUser)
            //////console.log("Adding to index " + i)
            data.push(p);
        }

        return data;
    }
}

async function getUserData(view, currentUser = null) {

    let viewer = await db.User.findByPk(view.userId);
    console.log('Viewer', view.userId)
    let viewerRes = await UserProfileLiteResource(viewer)

    let viewed = await db.User.findByPk(view.viewedUserId);
    console.log('Viewed', viewed)
    let viewedRes = await UserProfileLiteResource(viewed)



    const UserFullResource = {
        id: view.id,
        viewer: viewerRes,
        viewed: viewedRes,
        createdAt: view.createdAt,
        updatedAt: view.updatedAt
    }


    return UserFullResource;
}

export default UserProfileViewResource;