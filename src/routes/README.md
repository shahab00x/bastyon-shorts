# Routes

This directory contains route definitions for the application. Routes map incoming requests to specific controllers and middleware functions.

### Files
- **index.ts**: The main route file, which imports and sets up all the routes defined in other route files. Use this file to define general routes and import specific route handlers as needed.



### RPC API Calls

# getcomments
getcomments positional parameters
From pocketnet.core 
src/pocketdb/web/PocketCommentsRpc.cpp
:

[0] postid (string)
Transaction hash of the post whose comments you want. Parsed as postHash = request.params[0].get_str() (lines 32–37).
Use the Bastyon tx hash (your video_hash), not a numeric RowId.
[1] parentid (string, optional)
Parent comment hash to filter thread/replies. Parsed as parentHash = request.params[1].get_str() (lines 39–42).
Pass "" if you want top-level comments.
[2] address (string, optional)
Requester/viewer address (used for personalization like user-specific score flags). Parsed as addressHash = request.params[2].get_str() (lines 43–46).
Pass "" if you don’t need it.
[3] comment_ids (array of strings, optional)
If provided (non-empty array), the method ignores post/parent and fetches exactly those comments by their hashes via GetCommentsByHashes(...) (lines 47–69).
Only use this when you already know specific comment hashes.
Key behavior:

If you want “comments for a post,” pass [postHash] or [postHash, "", ""] and omit the 4th param.
