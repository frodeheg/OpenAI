# Validate from Homey perspective
# homey app validate

# Modify app.js so Homey refers to test setup
cp ./app.js ./app.js.bak
sed -i 's+const Homey = require('\''homey'\'');+const Homey = require('\''./test/homey'\'');+g' ./app.js
# sed -i 's+const { HomeyAPIApp } = require('\''homey-api'\'');+const { HomeyAPIApp } = require('\''./test/homey-api'\'');+g' ./app.js

# Run test
node test/test.js

# Undo the testing changes
sed -i 's+const Homey = require('\''./test/homey'\'');+const Homey = require('\''homey'\'');+g' ./app.js
# sed -i 's+const { HomeyAPIApp } = require('\''./test/homey-api'\'');+const { HomeyAPIApp } = require('\''homey-api'\'');+g' ./app.js
