#include <bits/stdc++.h>
#include <mariadb/mysql.h>
using namespace std;

// ─── DATABASE CLASS ──────────────────────────────────────────────
class Database {
private:
    MYSQL* conn;
    MYSQL_RES* res;
    MYSQL_ROW row;
    
public:
    Database() {
        conn = mysql_init(NULL);
        if (!mysql_real_connect(conn, "localhost", "shopping_user", 
                               "1234", "shopping_db", 0, NULL, 0)) {
            cerr << "ERROR: " << mysql_error(conn) << endl;
            exit(1);
        }
    }
    
    ~Database() { mysql_close(conn); }
    
    bool execute(string sql) {
        if (mysql_query(conn, sql.c_str())) {
            cerr << "ERROR: " << mysql_error(conn) << endl;
            return false;
        }
        return true;
    }
    
    vector<vector<string>> query(string sql) {
        vector<vector<string>> result;
        if (mysql_query(conn, sql.c_str())) {
            cerr << "ERROR: " << mysql_error(conn) << endl;
            return result;
        }
        res = mysql_store_result(conn);
        if (res) {
            while ((row = mysql_fetch_row(res))) {
                vector<string> row_data;
                for (int i = 0; i < mysql_num_fields(res); i++) {
                    row_data.push_back(row[i] ? row[i] : "NULL");
                }
                result.push_back(row_data);
            }
            mysql_free_result(res);
        }
        return result;
    }
    
    //  Updated: accepts image_url
    bool addProduct(int code, string name, float price, float discount, string image_url) {
        string sql = "INSERT INTO products VALUES(" + to_string(code) + 
                    ", '" + name + "', " + to_string(price) + ", " + 
                    to_string(discount) + ", '" + image_url + "') ON DUPLICATE KEY UPDATE " +
                    "name='" + name + "', price=" + to_string(price) + 
                    ", discount=" + to_string(discount) + ", image_url='" + image_url + "'";
        return execute(sql);
    }
    
    bool deleteProduct(int code) {
        string sql = "DELETE FROM products WHERE code = " + to_string(code);
        return execute(sql);
    }
    
    vector<vector<string>> getAllProducts() {
        return query("SELECT * FROM products ORDER BY code");
    }
    
    vector<vector<string>> getProduct(int code) {
        return query("SELECT * FROM products WHERE code = " + to_string(code));
    }
    
    // ─── SEARCH FUNCTIONS ──────────────────────────────────────────
    vector<vector<string>> searchProducts(string keyword) {
        string sql = "SELECT * FROM products WHERE ";
        sql += "name LIKE '%" + keyword + "%' OR ";
        sql += "CAST(code AS CHAR) LIKE '%" + keyword + "%'";
        sql += " ORDER BY code";
        return query(sql);
    }
    
    vector<vector<string>> searchByName(string name) {
        string sql = "SELECT * FROM products WHERE name LIKE '%" + name + "%' ORDER BY code";
        return query(sql);
    }
    
    vector<vector<string>> searchByPrice(float minPrice, float maxPrice) {
        string sql = "SELECT * FROM products WHERE price BETWEEN " + 
                    to_string(minPrice) + " AND " + to_string(maxPrice) + 
                    " ORDER BY price";
        return query(sql);
    }
};

// ─── Helper Functions ──────────────────────────────────────────
string escapeJsonString(string str) {
    string result;
    for (char c : str) {
        if (c == '"') result += "\\\"";
        else if (c == '\\') result += "\\\\";
        else if (c == '\n') result += "\\n";
        else if (c == '\r') result += "\\r";
        else if (c == '\t') result += "\\t";
        else result += c;
    }
    return result;
}

// ─── MAIN FUNCTION ──────────────────────────────────────────────
int main(int argc, char* argv[]) {
    Database db;
    
    if (argc == 1) {
        cout << "═══════════════════════════════════════════════════" << endl;
        cout << "  ANURAG SHOPPING COMPLEX - C++ BACKEND API" << endl;
        cout << "═══════════════════════════════════════════════════" << endl;
        cout << endl;
        cout << "   USAGE:" << endl;
        cout << "  ./shopping_backend list" << endl;
        cout << "  ./shopping_backend search <keyword>" << endl;
        cout << "  ./shopping_backend search-name <name>" << endl;
        cout << "  ./shopping_backend search-price <min> <max>" << endl;
        cout << "  ./shopping_backend add <code> <name> <price> <discount> <image_url>" << endl;  // updated
        cout << "  ./shopping_backend edit <code> <name> <price> <discount> <image_url>" << endl; // updated
        cout << "  ./shopping_backend delete <code>" << endl;
        cout << "  ./shopping_backend get <code>" << endl;
        cout << "  ./shopping_backend count" << endl;
        cout << endl;
        cout << "   EXAMPLES:" << endl;
        cout << "  ./shopping_backend list" << endl;
        cout << "  ./shopping_backend search oil" << endl;
        cout << "  ./shopping_backend search-name \"Mustard Oil\"" << endl;
        cout << "  ./shopping_backend search-price 50 200" << endl;
        cout << "  ./shopping_backend add 101 \"Mustard Oil\" 150 10 \"https://example.com/oil.jpg\"" << endl;
        cout << "  ./shopping_backend delete 101" << endl;
        cout << endl;
        cout << "  All outputs are in JSON format!" << endl;
        cout << "═══════════════════════════════════════════════════" << endl;
        return 0;
    }
    
    string command = argv[1];
    
    // ─── LIST PRODUCTS ──────────────────────────────────────────
    if (command == "list") {
        auto products = db.getAllProducts();
        cout << "[";
        for (size_t i = 0; i < products.size(); i++) {
            auto& p = products[i];
            cout << "{";
            cout << "\"code\":" << p[0] << ",";
            cout << "\"name\":\"" << escapeJsonString(p[1]) << "\",";
            cout << "\"price\":" << p[2] << ",";
            cout << "\"discount\":" << p[3] << ",";
            //  Added image_url
            cout << "\"image_url\":\"" << escapeJsonString(p[4]) << "\"";
            cout << "}";
            if (i < products.size() - 1) cout << ",";
        }
        cout << "]";
        return 0;
    }
    
    // ─── SEARCH PRODUCTS ──────────────────────────────────────────
    if (command == "search" && argc == 3) {
        string keyword = argv[2];
        auto products = db.searchProducts(keyword);
        cout << "[";
        for (size_t i = 0; i < products.size(); i++) {
            auto& p = products[i];
            cout << "{";
            cout << "\"code\":" << p[0] << ",";
            cout << "\"name\":\"" << escapeJsonString(p[1]) << "\",";
            cout << "\"price\":" << p[2] << ",";
            cout << "\"discount\":" << p[3] << ",";
            cout << "\"image_url\":\"" << escapeJsonString(p[4]) << "\"";
            cout << "}";
            if (i < products.size() - 1) cout << ",";
        }
        cout << "]";
        return 0;
    }
    
    // ─── SEARCH BY NAME ─────────────────────────────────────────
    if (command == "search-name" && argc == 3) {
        string name = argv[2];
        auto products = db.searchByName(name);
        cout << "[";
        for (size_t i = 0; i < products.size(); i++) {
            auto& p = products[i];
            cout << "{";
            cout << "\"code\":" << p[0] << ",";
            cout << "\"name\":\"" << escapeJsonString(p[1]) << "\",";
            cout << "\"price\":" << p[2] << ",";
            cout << "\"discount\":" << p[3] << ",";
            cout << "\"image_url\":\"" << escapeJsonString(p[4]) << "\"";
            cout << "}";
            if (i < products.size() - 1) cout << ",";
        }
        cout << "]";
        return 0;
    }
    
    // ─── SEARCH BY PRICE ─────────────────────────────────────────
    if (command == "search-price" && argc == 4) {
        float minPrice = atof(argv[2]);
        float maxPrice = atof(argv[3]);
        auto products = db.searchByPrice(minPrice, maxPrice);
        cout << "[";
        for (size_t i = 0; i < products.size(); i++) {
            auto& p = products[i];
            cout << "{";
            cout << "\"code\":" << p[0] << ",";
            cout << "\"name\":\"" << escapeJsonString(p[1]) << "\",";
            cout << "\"price\":" << p[2] << ",";
            cout << "\"discount\":" << p[3] << ",";
            cout << "\"image_url\":\"" << escapeJsonString(p[4]) << "\"";
            cout << "}";
            if (i < products.size() - 1) cout << ",";
        }
        cout << "]";
        return 0;
    }
    
    // ─── GET SINGLE PRODUCT ────────────────────────────────────
    if (command == "get" && argc == 3) {
        int code = atoi(argv[2]);
        auto product = db.getProduct(code);
        if (product.empty()) {
            cout << "{\"success\":false,\"message\":\"Product not found\"}";
            return 0;
        }
        auto& p = product[0];
        cout << "{";
        cout << "\"code\":" << p[0] << ",";
        cout << "\"name\":\"" << escapeJsonString(p[1]) << "\",";
        cout << "\"price\":" << p[2] << ",";
        cout << "\"discount\":" << p[3] << ",";
        cout << "\"image_url\":\"" << escapeJsonString(p[4]) << "\"";
        cout << "}";
        return 0;
    }
    
    // ─── ADD PRODUCT ─────────────────────────────────────────────
    //  Now expects 7 arguments (code, name, price, discount, image_url)
    if (command == "add" && argc == 7) {
        int code = atoi(argv[2]);
        string name = argv[3];
        float price = atof(argv[4]);
        float discount = atof(argv[5]);
        string image_url = argv[6];
        
        if (code <= 0 || name.empty() || price < 0 || discount < 0) {
            cout << "{\"success\":false,\"message\":\"Invalid input data\"}";
            return 0;
        }
        
        if (db.addProduct(code, name, price, discount, image_url)) {
            cout << "{\"success\":true,\"message\":\"Product added successfully\",\"code\":" << code << "}";
        } else {
            cout << "{\"success\":false,\"message\":\"Failed to add product\"}";
        }
        return 0;
    }
    
    // ─── EDIT PRODUCT ────────────────────────────────────────────
    //  Now expects 7 arguments (code, name, price, discount, image_url)
    if (command == "edit" && argc == 7) {
        int code = atoi(argv[2]);
        string name = argv[3];
        float price = atof(argv[4]);
        float discount = atof(argv[5]);
        string image_url = argv[6];
        
        auto existing = db.getProduct(code);
        if (existing.empty()) {
            cout << "{\"success\":false,\"message\":\"Product not found\"}";
            return 0;
        }
        
        if (db.addProduct(code, name, price, discount, image_url)) {
            cout << "{\"success\":true,\"message\":\"Product updated successfully\",\"code\":" << code << "}";
        } else {
            cout << "{\"success\":false,\"message\":\"Failed to update product\"}";
        }
        return 0;
    }
    
    // ─── DELETE PRODUCT ─────────────────────────────────────────
    if (command == "delete" && argc == 3) {
        int code = atoi(argv[2]);
        auto existing = db.getProduct(code);
        if (existing.empty()) {
            cout << "{\"success\":false,\"message\":\"Product not found\"}";
            return 0;
        }
        if (db.deleteProduct(code)) {
            cout << "{\"success\":true,\"message\":\"Product deleted successfully\",\"code\":" << code << "}";
        } else {
            cout << "{\"success\":false,\"message\":\"Failed to delete product\"}";
        }
        return 0;
    }
    
    // ─── COUNT PRODUCTS ──────────────────────────────────────────
    if (command == "count") {
        auto products = db.getAllProducts();
        cout << "{\"count\":" << products.size() << "}";
        return 0;
    }
    
    // ─── UNKNOWN COMMAND ─────────────────────────────────────────
    cout << "{\"success\":false,\"message\":\"Unknown command. Use: list, search, search-name, search-price, add, edit, delete, get, count\"}";
    return 0;
}